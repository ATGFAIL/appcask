export type {
  AppcaskConfig,
  ResolvedAppcaskConfig,
  AppcaskIdentity,
  AppcaskTheme,
  AppcaskNavigation,
  AppcaskFeatures,
  BridgeConfig,
  CapabilityGrant,
  CapabilityMatch,
  DeepLinkConfig,
  PushConfig,
  UpdatesConfig,
  HealthCheckConfig,
  UpdateManifest,
  NavigationTab,
  StatusBarTheme,
  SplashTheme,
  Color,
} from './types.js';

export {
  checkCapability,
  grantedCapabilities,
  type CapabilityDecision,
} from './capabilities.js';

export {
  parseManifest,
  manifestGate,
  reduceHealth,
  compareVersions,
  INITIAL_HEALTH,
  type ManifestGate,
  type HealthState,
  type HealthAction,
  type HealthPolicy,
} from './updates.js';

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
