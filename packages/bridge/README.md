# @appcask/bridge

The `window.appcask` ⇄ native wire protocol: message envelope, codec, method/event
type maps, and param validators. **Zero dependencies.** Shared by the shell and
[`@appcask/web`](../web).

```ts
import { decodeRequest, encodeOk, encodeError, onlyParams, urlParam } from '@appcask/bridge';

const req = decodeRequest(rawFromWebView);        // typed RequestMessage | null
onlyParams(req.params, ['url']);                  // throws BridgeError('INVALID_ARGUMENT')
const url = urlParam(req.params, 'url');          // https-only
return encodeOk(req.id, { shared: true });
```

- `RequestMessage` / `ResponseMessage` / `EventMessage` + `decode*` / `encode*`
- `MethodMap`, `EventMap` — the v1 surface, typed
- `BridgeError` + `BRIDGE_ERROR_CODES`
- param guards: `onlyParams`, `stringParam`, `numberParam`, `unitParam`, `enumParam`, `urlParam`
- `safeStringify` — JSON escaped (`<`, U+2028/9) for injection into a `<script>`

Full spec: [`BRIDGE_PROTOCOL.md`](../../BRIDGE_PROTOCOL.md).
