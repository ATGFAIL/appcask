import { assertConfig } from './validate.js';
import { applyDefaults } from './defaults.js';
import type { ResolvedAppcaskConfig } from './types.js';

export { applyDefaults } from './defaults.js';

/**
 * Validate `data` against the schema and fill in every default.
 *
 * Use this in tools (the CLI). The React Native shell should import the pure
 * `applyDefaults` from `@appcask/config/defaults` instead — it has no ajv / Node
 * dependencies — because the CLI has already validated the config at build time.
 */
export function resolveConfig(data: unknown): ResolvedAppcaskConfig {
  assertConfig(data);
  return applyDefaults(data);
}
