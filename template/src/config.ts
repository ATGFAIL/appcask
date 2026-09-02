import { applyDefaults } from '@appcask/config/defaults';
import type { AppcaskConfig, ResolvedAppcaskConfig } from '@appcask/config';
import rawConfig from '../appcask.config.json';

/**
 * The app's configuration, resolved once at startup.
 *
 * `appcask.config.json` is written by `appcask init` and rewritten by
 * `appcask android`. It was already validated against the schema by the CLI, so
 * here we only apply defaults — `applyDefaults` is pure and has no ajv / Node
 * dependencies.
 */
export const config: ResolvedAppcaskConfig = applyDefaults(rawConfig as unknown as AppcaskConfig);
