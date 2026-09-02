import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { loadProject } from '../project.js';
import { materializeAndroid } from '../native/materialize.js';
import { CliError, bold, cyan, dim, heading, info, line, ok, warn } from '../ui.js';

interface IosFlags {
  out?: string;
  force: boolean;
}

/**
 * Materialize the project (shared with `appcask android`) and patch the iOS
 * bundle id / display name / version. Finishing the iOS build still needs a Mac
 * with Xcode — this prints the remaining steps.
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
  for (const w of result.warnings) warn(w);

  warn('iOS is not finished — the shell compiles on Android; the Swift bridge needs Xcode.');

  heading('On a Mac');
  line(`  cd ${dim(rel(outDir))} && npm install`);
  line(`  cd ios && pod install`);
  line(`  open ${bold('ios/AppcaskShell.xcworkspace')}`);
  line();
  line(`  In Xcode, add to the AppcaskShell target:`);
  info('ios/AppcaskShell/AppcaskNative.swift');
  info('ios/AppcaskShell/AppcaskNative.mm');
  info('set Build Settings → Objective-C Bridging Header → ios/AppcaskShell/AppcaskShell-Bridging-Header.h');
  line();
  line(`  Then ${cyan('npx react-native run-ios')}. See docs/ios.md.`);
}

function rel(p: string): string {
  const cwd = process.cwd();
  return p.startsWith(cwd) ? '.' + p.slice(cwd.length) : p;
}
function slug(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'appcask-app';
}
