import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { platform } from 'node:os';
import { loadProject } from '../project.js';
import { androidCommand } from './android.js';
import { run, ensureAndroidSdk } from './build.js';
import { CliError, cyan, dim, green, heading, info, line, ok, warn } from '../ui.js';

interface RunFlags {
  project?: string;
  /** Don't start Metro (you already have it running). */
  noMetro: boolean;
  skipInstall: boolean;
}

/** Build a debug APK, install it on a connected device, launch it, then run Metro. */
export async function runCommand(flags: RunFlags): Promise<void> {
  const project = await loadProject();
  const applicationId = project.config.identity.packageName;

  const outDir = flags.project
    ? resolve(process.cwd(), flags.project)
    : await androidCommand({ out: flags.project, force: true });
  const androidDir = join(outDir, 'android');
  if (!existsSync(join(androidDir, 'gradlew'))) {
    throw new CliError(`${outDir} is missing android/gradlew`);
  }
  ensureAndroidSdk(androidDir);

  const adb = adbPath();
  const device = await pickDevice(adb);
  ok(`device: ${device.id}${device.abi ? ` (${device.abi})` : ''}`);

  if (!flags.skipInstall && !existsSync(join(outDir, 'node_modules'))) {
    heading('Installing shell dependencies');
    await run('npm', ['install', '--no-audit', '--no-fund'], outDir);
  }

  heading('Build + install (debug)');
  const gradlew = resolve(androidDir, platform() === 'win32' ? 'gradlew.bat' : 'gradlew');
  const args = [':app:installDebug'];
  if (device.abi) args.push(`-PreactNativeArchitectures=${device.abi}`);
  await run(gradlew, args, androidDir);

  await exec(adb, ['-s', device.id, 'reverse', 'tcp:8081', 'tcp:8081']).catch(() => undefined);
  await exec(adb, ['-s', device.id, 'shell', 'am', 'start', '-n', `${applicationId}/.MainActivity`]);
  ok(`launched ${green(applicationId)} on ${device.id}`);

  if (flags.noMetro) {
    line();
    line(`  ${dim('start the bundler yourself:')}  ${cyan(`cd ${rel(outDir)} && npx react-native start`)}`);
    return;
  }

  heading('Metro');
  info('the app loads its JS from here — keep this running, press Ctrl+C to stop');
  line();
  await run('npx', ['react-native', 'start'], outDir);
}

interface Device {
  id: string;
  abi?: string;
}

async function pickDevice(adb: string): Promise<Device> {
  const out = await capture(adb, ['devices']);
  if (out === null) {
    throw new CliError('adb not found — install Android platform-tools and add them to PATH');
  }
  const ids = out
    .split('\n')
    .slice(1)
    .map((l) => l.trim())
    .filter((l) => l.endsWith('\tdevice'))
    .map((l) => l.split('\t')[0] as string);
  if (ids.length === 0) {
    throw new CliError('no device — start an emulator or connect a phone with USB debugging on');
  }
  if (ids.length > 1) warn(`${ids.length} devices connected — using ${ids[0]}`);
  const id = ids[0] as string;
  const abi = (await capture(adb, ['-s', id, 'shell', 'getprop', 'ro.product.cpu.abi']))?.trim() || undefined;
  return { id, abi };
}

function adbPath(): string {
  const home = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  const bin = platform() === 'win32' ? 'adb.exe' : 'adb';
  if (home && existsSync(join(home, 'platform-tools', bin))) return join(home, 'platform-tools', bin);
  return 'adb';
}

function exec(cmd: string, args: string[]): Promise<void> {
  return new Promise((res, rej) => {
    const win = platform() === 'win32';
    const c = spawn(win && /[\\/]/.test(cmd) ? `"${cmd}"` : cmd, args, { stdio: 'inherit', shell: win });
    c.on('error', rej);
    c.on('close', (code) => (code === 0 ? res() : rej(new CliError(`${cmd} exited ${code}`))));
  });
}

function capture(cmd: string, args: string[]): Promise<string | null> {
  return new Promise((res) => {
    const win = platform() === 'win32';
    let out = '';
    const c = spawn(win && /[\\/]/.test(cmd) ? `"${cmd}"` : cmd, args, {
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: win,
    });
    c.stdout.on('data', (d) => (out += d));
    c.on('error', () => res(null));
    c.on('close', (code) => res(code === 0 ? out : null));
  });
}

function rel(p: string): string {
  const cwd = process.cwd();
  return p.startsWith(cwd) ? '.' + p.slice(cwd.length) : p;
}
