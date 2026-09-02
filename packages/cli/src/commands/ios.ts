import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { loadProject } from '../project.js';
import { materializeAndroid } from '../native/materialize.js';
import { CliError, cyan, dim, heading, info, line, ok, warn } from '../ui.js';

interface IosFlags {
  out?: string;
  force: boolean;
}

/**
 * Materialize the project (shared with `appcask android`) and patch iOS: bundle
 * id, display name, version, usage strings, and the Swift bridge is wired into
 * the Xcode target. Building an .app / .ipa needs macOS — your own Mac, or the
 * `ios.yml` GitHub Actions workflow (a hosted macOS runner, no Mac required).
 */
export async function iosCommand(flags: IosFlags): Promise<void> {
  const { config, root, raw } = await loadProject();
  const outDir = flags.out
    ? resolve(process.cwd(), flags.out)
    : join(root, `${slug(config.identity.appName)}-app`);

  if (existsSync(outDir) && !flags.force) {
    throw new CliError(`${outDir} already exists. Pass --force to overwrite it.`);
  }

  heading(`appcask ios  ${dim('→ ' + outDir)}`);
  const result = await materializeAndroid(outDir, root, raw, config);
  ok(`bundle id      ${config.identity.packageName}`);
  ok(`display name   ${config.identity.appName}`);
  ok(`version        ${config.identity.version}`);
  ok('Swift bridge   wired into the Xcode target');
  for (const w of result.warnings) warn(w);

  warn('iOS is not device-verified yet — the Swift module compiles but has not run on a device.');

  heading('Build it');
  info('No Mac? Push this repo and run the "Build iOS" GitHub Action (a hosted macOS runner).');
  line();
  line(`  On a Mac:`);
  line(`    cd ${dim(rel(outDir))} && npm install`);
  line(`    cd ios && pod install`);
  line(`    ${cyan('npx react-native run-ios')}`);
  line();
  line(dim(`  OAuth / Universal Links still need an Associated Domain in Xcode — see docs/ios.md.`));
}

function rel(p: string): string {
  const cwd = process.cwd();
  return p.startsWith(cwd) ? '.' + p.slice(cwd.length) : p;
}
function slug(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'appcask-app';
}
