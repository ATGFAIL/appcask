import {
  BridgeError,
  decodeRequest,
  encodeError,
  encodeOk,
  enumParam,
  onlyParams,
  stringParam,
  urlParam,
  type Params,
  type RequestMessage,
} from '@appcask/bridge';
import { checkCapability } from '@appcask/config/capabilities';
import { native } from './native';
import { config } from '../config';
import { SHELL_VERSION } from './version';

const HAPTIC_TYPES = ['light', 'medium', 'heavy', 'success', 'warning', 'error', 'selection'] as const;

export interface DispatchContext {
  platform: 'android' | 'ios';
  online: boolean;
  insets: { top: number; right: number; bottom: number; left: number };
  /** The URL of the page making the call — checked against `bridge.grants`. */
  currentUrl: string;
  /** Ask the shell to load a URL natively (the `navigate` method). */
  requestNavigate(url: string): void;
}

/**
 * Handle one raw message from the WebView. Returns a JS string to inject back
 * into the page (the response), or `null` if the message was not a bridge
 * request.
 */
export async function handleBridgeMessage(
  raw: string,
  ctx: DispatchContext,
): Promise<string | null> {
  const request = decodeRequest(raw);
  if (!request) return null;

  const gate = checkCapability(config.bridge.grants, ctx.currentUrl, request.method);
  if (!gate.allowed) {
    return encodeError(request.id, 'PERMISSION_DENIED', gate.reason ?? 'capability not granted');
  }

  try {
    const result = await dispatch(request, ctx);
    return encodeOk(request.id, result);
  } catch (err) {
    if (err instanceof BridgeError) {
      return encodeError(request.id, err.code, err.message);
    }
    return encodeError(request.id, 'INTERNAL', err instanceof Error ? err.message : String(err));
  }
}

async function dispatch(request: RequestMessage, ctx: DispatchContext): Promise<Params> {
  const { method, params } = request;

  switch (method) {
    case 'getInfo': {
      onlyParams(params, []);
      return {
        platform: ctx.platform,
        osVersion: await native.osVersion(),
        appVersion: config.identity.version,
        shellVersion: SHELL_VERSION,
        bridgeVersion: 1,
        insets: ctx.insets,
        online: ctx.online,
      };
    }

    case 'haptic': {
      onlyParams(params, ['type']);
      const type = enumParam(params, 'type', HAPTIC_TYPES) as string;
      await native.haptic(type);
      return {};
    }

    case 'share': {
      onlyParams(params, ['title', 'text', 'url']);
      const payload = {
        title: stringParam(params, 'title', { max: 200, optional: true }) ?? undefined,
        text: stringParam(params, 'text', { max: 4000, optional: true }) ?? undefined,
        url: urlParam(params, 'url', { optional: true }) ?? undefined,
      };
      if (!payload.title && !payload.text && !payload.url) {
        throw new BridgeError('INVALID_ARGUMENT', 'share needs at least one of title, text, url');
      }
      const shared = await native.share(payload);
      return { shared };
    }

    case 'navigate': {
      onlyParams(params, ['url']);
      const url = urlParam(params, 'url') as string;
      ctx.requestNavigate(url);
      return {};
    }

    case 'openExternal': {
      onlyParams(params, ['url']);
      const url = urlParam(params, 'url') as string;
      await native.openExternal(url);
      return {};
    }

    case 'setStatusBar': {
      onlyParams(params, ['style', 'color']);
      const style = enumParam(params, 'style', ['light', 'dark'] as const, { optional: true });
      const color = stringParam(params, 'color', { max: 9, optional: true });
      await native.setStatusBar(style, color);
      return {};
    }

    case 'secureStore.get': {
      onlyParams(params, ['key']);
      const key = secureKey(params);
      return { value: await native.secureGet(key) };
    }
    case 'secureStore.set': {
      onlyParams(params, ['key', 'value']);
      const key = secureKey(params);
      const value = stringParam(params, 'value', { max: 16_384, allowEmpty: true }) as string;
      await native.secureSet(key, value);
      return {};
    }
    case 'secureStore.remove': {
      onlyParams(params, ['key']);
      await native.secureRemove(secureKey(params));
      return {};
    }

    case 'clipboard.read': {
      onlyParams(params, []);
      return { text: await native.clipboardRead() };
    }
    case 'clipboard.write': {
      onlyParams(params, ['text']);
      const text = stringParam(params, 'text', { max: 100_000, allowEmpty: true }) as string;
      await native.clipboardWrite(text);
      return {};
    }

    default:
      throw new BridgeError('NOT_SUPPORTED', `unknown method "${method}"`);
  }
}

function secureKey(params: Params): string {
  const key = stringParam(params, 'key', { max: 128 }) as string;
  if (!/^[A-Za-z0-9_.:-]+$/.test(key)) {
    throw new BridgeError('INVALID_ARGUMENT', 'secureStore key must match [A-Za-z0-9_.:-]');
  }
  return key;
}
