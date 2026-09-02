import { spawn } from 'node:child_process';
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { platform } from 'node:os';
import { loadProject } from '../project.js';
import { androidCommand } from './android.js';
import { CliError, bold, cyan, dim, green, heading, info, line, ok, warn } from '../ui.js';

interface BuildFlags {
  /** An existing materialized project. Otherwise one is created / refreshed. */
  project?: string;
  /** `.aab` instead of `.apk`. */
  aab: boolean;
  /** Debug build (needs a running Metro for JS). Default is a self-contained release. */
  debug: boolean;
  /** Skip `npm install` in the project. */
  skipInstall: boolean;
  /** Comma-separated ABIs, e.g. `arm64-v8a,x86_64`. Default: all four. */
  archs?: string;
  force: boolean;
}

export async function buildAndroidCommand(flags: BuildFlags): Promise<void> {
  const project = await loadProject();

  const outDir = flags.project
    ? resolve(process.cwd(), flags.project)
    : await androidCommand({ out: flags.project, force: true });

  const androidDir = join(outDir, 'android');
  if (!existsSync(join(androidDir, 'gradlew'))) {
    throw new CliError(`${outDir} does not look like an appcask project (no android/gradlew)`);
  }

  ensureAndroidSdk(androidDir);

  if (platform() === 'win32' && outDir.length > 90) {
    warn(
      `this project path is ${outDir.length} chars — Windows' 260-char limit breaks the CMake / NDK build ` +
        `deep inside it. Build from a short path (e.g. C:\\a) or enable long paths ` +
        `(git config --global core.longpaths true; the LongPathsEnabled registry key).`,
    );
  }

  if (!flags.skipInstall && !existsSync(join(outDir, 'node_modules'))) {
    heading('Installing shell dependencies');
    await run('npm', ['install', '--no-audit', '--no-fund'], outDir);
  }

  const variant = flags.debug ? 'Debug' : 'Release';
  const task = `${flags.aab ? 'bundle' : 'assemble'}${variant}`;
  heading(`Gradle :app:${task}`);
  // Absolute path: Git Bash on Windows sets NoDefaultCurrentDirectoryInExePath,
  // so cmd.exe won't resolve a bare `gradlew.bat` from the cwd.
  const gradlew = resolve(androidDir, platform() === 'win32' ? 'gradlew.bat' : 'gradlew');
  const gradleArgs = [`:app:${task}`];
  if (flags.archs) gradleArgs.push(`-PreactNativeArchitectures=${flags.archs.replace(/\s+/g, '')}`);
  await run(gradlew, gradleArgs, androidDir);

  const artifact = await collectArtifact(androidDir, project.root, {
    aab: flags.aab,
    variant: variant.toLowerCase(),
    appSlug: slug(project.config.identity.appName),
    version: project.config.identity.version,
  });

  heading('Done');
  ok(green(artifact.dest));
  if (flags.debug) {
    info('Debug build — it loads JS from Metro. Run `npx react-native start` in the project first.');
  } else {
    const signed = releaseKeystoreConfigured(androidDir);
    info('Self-contained — installs and runs without Metro.');
    if (!signed) {
      warn(
        'signed with the TEMPLATE DEBUG KEY. The Play Store rejects this, and App Links / the OAuth ' +
          `return won't verify against a real fingerprint. Set signingConfigs.release in ` +
          `${dim(join(outDir, 'android/app/build.gradle'))} before publishing — see docs/production.md.`,
      );
    }
  }
  line();
  line(`  install:  ${cyan(`adb install -r "${artifact.dest}"`)}`);
}

export function ensureAndroidSdk(androidDir: string): void {
  if (process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT) return;
  if (existsSync(join(androidDir, 'local.properties'))) return;
  throw new CliError(
    'Android SDK not found.\n' +
      '  Set ANDROID_HOME (or ANDROID_SDK_ROOT), or create android/local.properties with:\n' +
      '    sdk.dir=/absolute/path/to/Android/Sdk',
  );
}

async function collectArtifact(
  androidDir: string,
  configRoot: string,
  opts: { aab: boolean; variant: string; appSlug: string; version: string },
): Promise<{ dest: string }> {
  const kind = opts.aab ? 'bundle' : 'apk';
  const dir = join(androidDir, 'app', 'build', 'outputs', kind, opts.variant);
  const ext = opts.aab ? '.aab' : '.apk';
  const found = existsSync(dir) ? (await readdir(dir)).filter((f) => f.endsWith(ext)) : [];
  if (found.length === 0) throw new CliError(`build finished but no ${ext} was found in ${dir}`);

  const outDir = join(configRoot, 'build');
  await mkdir(outDir, { recursive: true });
  const dest = join(outDir, `${opts.appSlug}-${opts.version}-${opts.variant}${ext}`);
  await copyFile(join(dir, found[0] as string), dest);
  return { dest };
}

export /** Has the release build type been pointed at a non-debug signing config? */
function releaseKeystoreConfigured(androidDir: string): boolean {
  try {
    const gradle = readFileSync(join(androidDir, 'app', 'build.gradle'), 'utf8');
    const release = /release\s*\{[^}]*\}/s.exec(gradle)?.[0] ?? '';
    return /signingConfig\s+signingConfigs\.release/.test(release);
  } catch {
    return false;
  }
}

export function run(cmd: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    line(dim(`  $ ${cmd} ${args.join(' ')}`));
    const win = platform() === 'win32';
    // On Windows we need shell:true so `.bat` shims run. Quote the command only
    // when it's an actual path (may contain spaces) — quoting a bare name like
    // `npm` makes cmd.exe set an empty %0 dir, which breaks `%~dp0` inside
    // npm.cmd and it can't find itself.
    const spawnCmd = win && /[\\/]/.test(cmd) ? `"${cmd}"` : cmd;
    const child = spawn(spawnCmd, args, { cwd, stdio: 'inherit', shell: win });
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolvePromise() : reject(new CliError(`${bold(cmd)} exited with code ${code}`)),
    );
  });
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'app';
}
