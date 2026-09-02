import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { ErrorObject } from 'ajv/dist/2020.js';
import ajvFormatsModule from 'ajv-formats';
import type { AppcaskConfig } from './types.js';

const addFormats = ajvFormatsModule.default;

/**
 * The JSON Schema, read from the package root at runtime. Kept as a file (not a
 * TS import) so `schema.json` stays the single, tool-readable source of truth.
 */
const schema = JSON.parse(
  readFileSync(new URL('../schema.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;

const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true, strict: false });
addFormats(ajv);
const validator = ajv.compile<AppcaskConfig>(schema);

export interface ConfigProblem {
  /** JSON Pointer to the offending value, e.g. `/identity/packageName`. */
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  problems: ConfigProblem[];
}

/** The raw JSON Schema, exported so tooling (docs, editors) can reuse it. */
export { schema as configSchema };

/**
 * Validate an already-parsed object against the appcask config schema.
 * Does not apply defaults — see `resolveConfig`.
 */
export function validateConfig(data: unknown): ValidationResult {
  const valid = validator(data);
  if (valid) return { valid: true, problems: [] };
  const problems: ConfigProblem[] = (validator.errors ?? []).map((err: ErrorObject) => ({
    path: err.instancePath || '/',
    message: formatError(err),
  }));
  return { valid: false, problems };
}

/** Validate and throw a single readable error listing every problem. */
export function assertConfig(data: unknown): asserts data is AppcaskConfig {
  const { valid, problems } = validateConfig(data);
  if (valid) return;
  const lines = problems.map((p) => `  ${p.path}  ${p.message}`);
  throw new AppcaskConfigError(`Invalid appcask config:\n${lines.join('\n')}`, problems);
}

export class AppcaskConfigError extends Error {
  readonly problems: ConfigProblem[];
  constructor(message: string, problems: ConfigProblem[]) {
    super(message);
    this.name = 'AppcaskConfigError';
    this.problems = problems;
  }
}

function formatError(err: ErrorObject): string {
  switch (err.keyword) {
    case 'additionalProperties':
      return `unknown property "${String(err.params.additionalProperty)}"`;
    case 'required':
      return `missing required property "${String(err.params.missingProperty)}"`;
    case 'pattern':
      return `${err.message} (${String(err.params.pattern)})`;
    case 'enum':
      return `must be one of: ${(err.params.allowedValues as unknown[])?.join(', ')}`;
    default:
      return err.message ?? 'is invalid';
  }
}
