// Copy the RN template and the built @appcask/* packages into the CLI so a
// published `appcask` is self-contained. Run by `prepack`.
import { cp, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cliDir = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = join(cliDir, '..', '..');
const dest = join(cliDir, 'templates');

const SKIP = new Set(['node_modules', 'build', '.gradle', 'Pods', 'local.properties', '.appcask']);

await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });

await cp(join(repoRoot, 'template'), join(dest, 'react-native'), {
  recursive: true,
  filter: (from) => {
    const base = from.split('/').pop() ?? '';
    return !SKIP.has(base) && !base.startsWith('_APPCASK');
  },
});

for (const name of ['bridge', 'router', 'config']) {
  const src = join(repoRoot, 'packages', name);
  const out = join(dest, 'packages', name);
  if (!existsSync(join(src, 'dist'))) {
    throw new Error(`packages/${name}/dist missing — run "pnpm -r build" first`);
  }
  await mkdir(out, { recursive: true });
  await cp(join(src, 'dist'), join(out, 'dist'), { recursive: true });
  await cp(join(src, 'package.json'), join(out, 'package.json'));
  if (existsSync(join(src, 'schema.json'))) {
    await cp(join(src, 'schema.json'), join(out, 'schema.json'));
  }
}

console.log('bundled template + packages -> packages/cli/templates/');
