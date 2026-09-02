import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { loadProject } from '../project.js';
import { materializeAndroid } from '../native/materialize.js';
import { CliError, bold, cyan, dim, heading, line, ok, warn } from '../ui.js';

interface AndroidFlags {
  /** Output directory. Default `./<slug>-android` next to the config. */
  out?: string;
  force: boolean;
}

export async function androidCommand(flags: AndroidFlags): Promise<string> {
  const project = await loadProject();
  const { config, root, raw } = project;

  const outDir = flags.out
    ? resolve(process.cwd(), flags.out)
    : join(root, `${slug(config.identity.appName)}-android`);

  if (existsSync(outDir) && !flags.force) {
    throw new CliError(`${outDir} already exists. Pass --force to overwrite it.`);
  }

  heading(`appcask android  ${dim('→ ' + outDir)}`);

  const result = await materializeAndroid(outDir, root, raw, config);

  ok(`package        ${config.identity.packageName}`);
  ok(`app name       ${config.identity.appName}`);
  ok(`version        ${config.identity.version}`);
  ok(`start URL      ${config.startUrl}`);
  ok(result.wroteIcons ? 'icons          generated from assets/icon.png' : 'icons          template placeholders');
  ok('@appcask/*     vendored into appcask-packages/');
  for (const w of result.warnings) warn(w);

  heading('Next');
  line(`  cd ${dim(rel(outDir))}`);
  line(`  npm install`);
  line(`  ${cyan('appcask build android')}   ${dim('or:  cd android && ./gradlew assembleRelease')}`);
  line();
  line(dim(`  ${bold('appcask.config.json')} is copied in — re-run ${bold('appcask android --force')} after editing it.`));

  return outDir;
}

function rel(p: string): string {
  const cwd = process.cwd();
  return p.startsWith(cwd) ? '.' + p.slice(cwd.length) : p;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'appcask-app';
}
