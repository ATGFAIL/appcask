import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { resolveConfig, type ResolvedAppcaskConfig, type AppcaskConfig } from '@appcask/config';
import { CliError } from './ui.js';

export const CONFIG_FILENAME = 'appcask.config.json';

export interface LoadedProject {
  /** Directory holding appcask.config.json. */
  root: string;
  configPath: string;
  raw: AppcaskConfig;
  config: ResolvedAppcaskConfig;
}

/** Walk up from `start` looking for appcask.config.json. */
export function findConfig(start = process.cwd()): string | null {
  let dir = resolve(start);
  for (;;) {
    const candidate = join(dir, CONFIG_FILENAME);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export async function loadProject(start = process.cwd()): Promise<LoadedProject> {
  const configPath = findConfig(start);
  if (!configPath) {
    throw new CliError(
      `no ${CONFIG_FILENAME} found here or in any parent directory.\n` +
        `Run "appcask init" to create one.`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(configPath, 'utf8'));
  } catch (err) {
    throw new CliError(`${configPath}: not valid JSON (${(err as Error).message})`);
  }

  let config: ResolvedAppcaskConfig;
  try {
    config = resolveConfig(parsed);
  } catch (err) {
    // resolveConfig throws AppcaskConfigError with a multi-line message.
    throw new CliError((err as Error).message);
  }

  return { root: dirname(configPath), configPath, raw: parsed as AppcaskConfig, config };
}
