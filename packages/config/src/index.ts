export type {
  AppcaskConfig,
  ResolvedAppcaskConfig,
  AppcaskIdentity,
  AppcaskTheme,
  AppcaskNavigation,
  AppcaskFeatures,
  BridgeConfig,
  DeepLinkConfig,
  PushConfig,
  NavigationTab,
  StatusBarTheme,
  SplashTheme,
  Color,
} from './types.js';

export {
  validateConfig,
  assertConfig,
  AppcaskConfigError,
  configSchema,
  type ConfigProblem,
  type ValidationResult,
} from './validate.js';

export { resolveConfig, applyDefaults } from './resolve.js';

/** Config schema version. Bumped when the shape changes incompatibly. */
export const CONFIG_SCHEMA_VERSION = 1 as const;
