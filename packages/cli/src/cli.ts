#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs, flagBool, flagStr } from './args.js';
import { CliError, bold, cyan, dim, line, red } from './ui.js';
import { initCommand } from './commands/init.js';
import { doctorCommand } from './commands/doctor.js';
import { assetsCommand } from './commands/assets.js';
import { androidCommand } from './commands/android.js';
import { buildAndroidCommand } from './commands/build.js';
import { stubCommand } from './commands/stub.js';

const BOOLEAN_FLAGS = [
  'force',
  'yes',
  'offline',
  'aab',
  'debug',
  'skip-install',
  'help',
  'version',
  'h',
  'v',
];

const HELP = `${bold('appcask')} — turn any website into a real Android & iOS app

${bold('Usage')}
  appcask <command> [options]

${bold('Commands')}
  ${cyan('init')} [dir]           create appcask.config.json and assets/
  ${cyan('doctor')}               validate the config and check your domain setup
  ${cyan('assets')}               generate every icon + splash size (preview)
  ${cyan('android')} [--out dir]  materialize the Android project from the config
  ${cyan('build')} android        materialize + build a signed APK / AAB
  ${cyan('run')}                  install a debug build on a device             ${dim('(coming soon)')}

${bold('Options')}
  --yes            init: accept defaults, no prompts
  --force          init / android / build: overwrite existing output
  --offline        doctor: skip network checks
  --name, --url, --package-name   init: preset an answer
  --out <dir>      android: where to write the project (default <slug>-android)
  --project <dir>  build: use an existing materialized project
  --aab            build: produce an .aab instead of an .apk
  --debug          build: debug variant (needs Metro running)
  --skip-install   build: don't run npm install
  -v, --version    print version
  -h, --help       print this help
`;

async function version(): Promise<string> {
  const pkgUrl = new URL('../package.json', import.meta.url);
  const pkg = JSON.parse(await readFile(fileURLToPath(pkgUrl), 'utf8')) as { version: string };
  return pkg.version;
}

async function main(argv: string[]): Promise<number> {
  const { positionals, flags } = parseArgs(argv, BOOLEAN_FLAGS);
  const command = positionals[0];

  if (flagBool(flags, 'version', 'v') && !command) {
    line(await version());
    return 0;
  }
  if (!command || flagBool(flags, 'help', 'h')) {
    line(HELP);
    return command ? 0 : 1;
  }

  switch (command) {
    case 'init':
      await initCommand({
        dir: positionals[1] ?? '.',
        force: flagBool(flags, 'force'),
        yes: flagBool(flags, 'yes'),
        name: flagStr(flags, 'name'),
        packageName: flagStr(flags, 'package-name', 'packageName'),
        url: flagStr(flags, 'url'),
      });
      return 0;

    case 'doctor':
      await doctorCommand({ offline: flagBool(flags, 'offline') });
      return 0;

    case 'assets':
      await assetsCommand({ out: flagStr(flags, 'out') });
      return 0;

    case 'android':
      await androidCommand({ out: flagStr(flags, 'out'), force: flagBool(flags, 'force') });
      return 0;

    case 'build': {
      const target = positionals[1] ?? 'android';
      if (target !== 'android') {
        line(red(`only "appcask build android" is supported right now`));
        return 1;
      }
      await buildAndroidCommand({
        project: flagStr(flags, 'project'),
        aab: flagBool(flags, 'aab'),
        debug: flagBool(flags, 'debug'),
        skipInstall: flagBool(flags, 'skip-install', 'skipInstall'),
        force: flagBool(flags, 'force'),
      });
      return 0;
    }

    case 'ios':
    case 'run':
      await stubCommand(command);
      return 0;

    default:
      line(red(`unknown command "${command}"`));
      line(HELP);
      return 1;
  }
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    if (err instanceof CliError) {
      line(`${red('error')} ${err.message}`);
      process.exit(1);
    }
    line(red('unexpected error:'));
    console.error(err);
    process.exit(1);
  });
