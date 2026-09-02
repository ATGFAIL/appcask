import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { validateConfig, type AppcaskConfig } from '@appcask/config';
import { CONFIG_FILENAME } from '../project.js';
import { CliError, bold, cyan, dim, heading, line, ok } from '../ui.js';

interface InitFlags {
  dir: string;
  force: boolean;
  yes: boolean;
  name?: string;
  packageName?: string;
  url?: string;
}

export async function initCommand(flags: InitFlags): Promise<void> {
  const dir = resolve(flags.dir);
  const configPath = join(dir, CONFIG_FILENAME);

  if (existsSync(configPath) && !flags.force) {
    throw new CliError(`${configPath} already exists. Pass --force to overwrite.`);
  }

  const answers = flags.yes
    ? {
        appName: flags.name ?? 'My App',
        packageName: flags.packageName ?? 'com.example.app',
        startUrl: flags.url ?? 'https://example.com',
      }
    : await prompt(flags);

  const host = safeHost(answers.startUrl);
  const config: AppcaskConfig = {
    $schema: 'https://appcask.dev/schema/v1.json',
    identity: {
      appName: answers.appName,
      packageName: answers.packageName,
      version: '1.0.0',
    },
    startUrl: answers.startUrl,
    internalHosts: host ? [host] : [],
    theme: {
      statusBar: { style: 'dark', color: '#ffffff' },
      splash: { background: '#ffffff', logo: 'assets/splash-logo.png' },
    },
    features: {
      pullToRefresh: true,
      offlinePage: true,
      // Embedded Google / Apple sign-in works with the default clean User-Agent.
      // Only add externalBrowserAuth (+ host assetlinks.json) if a provider still
      // refuses — see docs/gotchas.md.
    },
  };

  const { valid, problems } = validateConfig(config);
  if (!valid) {
    throw new CliError(
      'the answers produced an invalid config:\n' +
        problems.map((p) => `  ${p.path}  ${p.message}`).join('\n'),
    );
  }

  await mkdir(dir, { recursive: true });
  await mkdir(join(dir, 'assets'), { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  await writeFile(join(dir, 'assets', 'README.md'), ASSETS_README, 'utf8');

  heading('Created');
  ok(rel(dir, configPath));
  ok(rel(dir, join(dir, 'assets')) + '/  (drop icon.png 1024×1024 and splash-logo.png here)');

  heading('Next');
  line(`  ${cyan('appcask doctor')}   ${dim('validate the config and check your domain setup')}`);
  line(`  ${cyan('appcask assets')}   ${dim('generate every icon + splash size')}`);
  line(`  ${cyan('appcask build android')}`);
  line();
  line(dim(`  Edit ${bold(CONFIG_FILENAME)} to add deep links, native auth domains, and theming.`));
}

async function prompt(flags: InitFlags): Promise<{ appName: string; packageName: string; startUrl: string }> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const appName = (await rl.question(`App name ${dim('(shown under the icon)')}: `)) || flags.name || 'My App';
    const startUrl =
      (await rl.question(`Start URL ${dim('(https://…)')}: `)) || flags.url || 'https://example.com';
    const suggested = flags.packageName ?? suggestPackage(startUrl);
    const packageName = (await rl.question(`Android package / iOS bundle id ${dim(`(${suggested})`)}: `)) || suggested;
    return { appName, packageName, startUrl };
  } finally {
    rl.close();
  }
}

function suggestPackage(url: string): string {
  const host = safeHost(url);
  if (!host) return 'com.example.app';
  const parts = host.split('.').filter((p) => p && p !== 'www').reverse();
  return (parts.length >= 2 ? parts : ['com', 'example', ...parts]).join('.').replace(/[^a-z0-9.]/gi, '');
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function rel(root: string, p: string): string {
  return p.startsWith(root) ? p.slice(root.length + 1) : p;
}

const ASSETS_README = `# assets

Put your source images here. \`appcask assets\` reads these and generates every
platform size.

| file | size | purpose |
|------|------|---------|
| \`icon.png\` | 1024×1024, opaque | launcher / App Store icon |
| \`icon-foreground.png\` | 1024×1024, transparent | Android adaptive-icon foreground (optional) |
| \`splash-logo.png\` | ~512×512, transparent | centred logo on the splash screen |
`;
