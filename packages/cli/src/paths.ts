import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CliError } from './ui.js';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Locate the React Native shell template.
 *
 *  - published: bundled at `<cli>/templates/react-native`
 *  - in the repo: `<repo>/template`
 */
export function templateDir(): string {
  const bundled = resolve(here, '..', 'templates', 'react-native');
  if (existsSync(join(bundled, 'package.json'))) return bundled;

  let dir = here;
  for (let i = 0; i < 6; i += 1) {
    const candidate = join(dir, 'template');
    if (existsSync(join(candidate, 'App.tsx')) && existsSync(join(candidate, 'android'))) {
      return candidate;
    }
    dir = dirname(dir);
  }
  throw new CliError('could not find the React Native template (expected <cli>/templates/react-native or <repo>/template)');
}

/**
 * The built `@appcask/*` packages the shell depends on. Vendored into a
 * materialized project so it is self-contained.
 */
export function appcaskPackageDirs(): { name: string; dir: string }[] {
  const names = ['bridge', 'router', 'config'];
  // dev: sibling packages/. published: bundled next to templates/.
  const roots = [
    resolve(here, '..', 'templates', 'packages'),
    resolve(here, '..', '..'),
  ];
  for (const root of roots) {
    if (names.every((n) => existsSync(join(root, n, 'package.json')))) {
      return names.map((n) => ({ name: `@appcask/${n}`, dir: join(root, n) }));
    }
  }
  throw new CliError('could not find the built @appcask/* packages to vendor');
}
