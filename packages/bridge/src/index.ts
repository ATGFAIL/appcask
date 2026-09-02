export {
  BRIDGE_CHANNEL,
  BRIDGE_VERSION,
  REQUEST_ID_PATTERN,
  decodeRequest,
  decodeResponse,
  decodeEvent,
  encodeRequest,
  encodeOk,
  encodeError,
  encodeEvent,
  safeStringify,
  type BridgeMessage,
  type RequestMessage,
  type ResponseMessage,
  type EventMessage,
  type Params,
  type JsonValue,
} from './protocol.js';

export {
  BRIDGE_ERROR_CODES,
  BridgeError,
  isBridgeErrorCode,
  type BridgeErrorCode,
} from './errors.js';

export {
  METHOD_NAMES,
  EVENT_NAMES,
  isMethodName,
  isEventName,
  type MethodMap,
  type MethodName,
  type MethodParams,
  type MethodResult,
  type EventMap,
  type EventName,
  type DeviceInfo,
  type Insets,
  type HapticType,
  type SharePayload,
  type StatusBarPayload,
  type Platform,
} from './methods.js';

export {
  onlyParams,
  stringParam,
  numberParam,
  unitParam,
  boolParam,
  enumParam,
  urlParam,
} from './params.js';
