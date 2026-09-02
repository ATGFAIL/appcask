import { cp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import xcode from 'xcode';
import type { ResolvedAppcaskConfig } from '@appcask/config';
import { appcaskPackageDirs, templateDir } from '../paths.js';
import { generateAndroidIcons, generatePlayStoreIcon } from './icons.js';
import {
  colorsXml,
  deeplinkHost,
  packageToPath,
  patchAppJson,
  patchBuildGradle,
  patchKotlinPackage,
  patchManifestDeepLinkHosts,
  patchManifestPermissions,
  patchManifestShareTarget,
  patchStringsXml,
} from './androidPatch.js';

const OLD_PACKAGE = 'com.appcaskshell';

// The template's metro.config.js watches the monorepo root; a materialized
// project is standalone (the @appcask/* packages are vendored under it), so it
// gets a plain config instead.
const STANDALONE_METRO = `const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

// appcask-packages/ holds the vendored @appcask/* packages, linked via file:.
module.exports = mergeConfig(getDefaultConfig(__dirname), {});
`;

const COPY_SKIP = new Set([
  'node_modules',
  'build',
  '.gradle',
  'Pods',
  'local.properties',
  '.appcask',
]);

export interface MaterializeResult {
  outDir: string;
  wroteIcons: boolean;
  warnings: string[];
}

/**
 * Copy the RN template into `outDir` and rewrite it for this project: package
 * name, app name, version, deep-link host, theme colours, and (if present)
 * icons from `configRoot/assets`.
 */
export async function materializeAndroid(
  outDir: string,
  configRoot: string,
  rawConfig: unknown,
  config: ResolvedAppcaskConfig,
): Promise<MaterializeResult> {
  const warnings: string[] = [];
  const src = templateDir();

  await mkdir(outDir, { recursive: true });
  await cp(src, outDir, {
    recursive: true,
    filter: (from) => {
      const base = basename(from); // basename, not split('/') — Windows paths use \
      if (COPY_SKIP.has(base)) return false;
      if (base.startsWith('_APPCASK')) return false;
      return true;
    },
  });

  // The template's jest setup reaches back into the monorepo — drop it from a
  // standalone project.
  for (const p of ['jest.config.js', 'jest.resolver.js', '__tests__', 'README.md']) {
    await rm(join(outDir, p), { recursive: true, force: true });
  }

  await vendorPackages(outDir);
  await writeFile(
    join(outDir, 'appcask.config.json'),
    JSON.stringify(rawConfig, null, 2) + '\n',
    'utf8',
  );

  await patchPackageJson(outDir, config);
  await writeFile(join(outDir, 'metro.config.js'), STANDALONE_METRO, 'utf8');
  await patchAndroid(outDir, config, warnings);
  await patchIos(outDir, config);
  await patchPush(outDir, configRoot, config, warnings);
  const wroteIcons = await writeIcons(outDir, configRoot, config, warnings);

  return { outDir, wroteIcons, warnings };
}

async function vendorPackages(outDir: string): Promise<void> {
  const vendorDir = join(outDir, 'appcask-packages');
  await rm(vendorDir, { recursive: true, force: true });
  for (const { name, dir } of appcaskPackageDirs()) {
    const short = name.split('/')[1] as string;
    const dest = join(vendorDir, short);
    await mkdir(dest, { recursive: true });
    await cp(join(dir, 'dist'), join(dest, 'dist'), { recursive: true });
    await writeFile(join(dest, 'package.json'), sanitizedPackageJson(await readFile(join(dir, 'package.json'), 'utf8')), 'utf8');
    if (existsSync(join(dir, 'schema.json'))) {
      await cp(join(dir, 'schema.json'), join(dest, 'schema.json'));
    }
  }

  const pkgPath = join(outDir, 'package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  for (const key of Object.keys(pkg.dependencies ?? {})) {
    if (key.startsWith('@appcask/')) {
      pkg.dependencies![key] = `file:./appcask-packages/${key.split('/')[1]}`;
    }
  }
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
}

/**
 * A vendored package ships pre-built `dist/`. Keep only the fields npm needs to
 * link it, and drop devDependencies / `workspace:` + `file:` deps that would
 * make `npm install` fail in a standalone project.
 */
export function sanitizedPackageJson(source: string): string {
  const p = JSON.parse(source) as Record<string, unknown>;
  const keep = ['name', 'version', 'description', 'license', 'type', 'main', 'types', 'exports', 'sideEffects'] as const;
  const out: Record<string, unknown> = {};
  for (const k of keep) if (p[k] !== undefined) out[k] = p[k];

  const deps = (p.dependencies ?? {}) as Record<string, string>;
  const cleanDeps: Record<string, string> = {};
  for (const [name, range] of Object.entries(deps)) {
    if (range.startsWith('workspace:')) cleanDeps[name] = `file:../${name.split('/')[1]}`;
    else if (!range.startsWith('file:')) cleanDeps[name] = range;
  }
  if (Object.keys(cleanDeps).length > 0) out.dependencies = cleanDeps;
  return JSON.stringify(out, null, 2) + '\n';
}

async function patchPackageJson(outDir: string, config: ResolvedAppcaskConfig): Promise<void> {
  const pkgPath = join(outDir, 'package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8')) as Record<string, unknown>;
  pkg.name = slug(config.identity.appName) || 'appcask-app';
  pkg.version = config.identity.version;
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
}

async function patchAndroid(
  outDir: string,
  config: ResolvedAppcaskConfig,
  warnings: string[],
): Promise<void> {
  const androidApp = join(outDir, 'android', 'app');
  const res = join(androidApp, 'src', 'main', 'res');

  await edit(join(androidApp, 'build.gradle'), (c) =>
    patchBuildGradle(c, {
      oldPackage: OLD_PACKAGE,
      packageName: config.identity.packageName,
      version: config.identity.version,
    }),
  );

  await edit(join(res, 'values', 'strings.xml'), (c) =>
    patchStringsXml(c, {
      appName: config.identity.appName,
      deeplinkHost: deeplinkHost(config),
      shareUrl: config.features.shareTarget?.url,
    }),
  );

  await edit(join(androidApp, 'src', 'main', 'AndroidManifest.xml'), (c) =>
    patchManifestDeepLinkHosts(
      patchManifestShareTarget(
        patchManifestPermissions(c, {
          fileAccess: config.features.fileAccess,
          downloads: config.features.downloads,
        }),
        config.features.shareTarget != null,
      ),
      config.internalHosts.filter((h) => h !== deeplinkHost(config)),
    ),
  );

  await edit(join(outDir, 'app.json'), (c) => patchAppJson(c, { appName: config.identity.appName }));

  await writeFile(join(res, 'values', 'colors.xml'), colorsXml(config), 'utf8');

  // --- rename the Kotlin package ---
  const javaRoot = join(androidApp, 'src', 'main', 'java');
  const oldDir = join(javaRoot, packageToPath(OLD_PACKAGE));
  const newDir = join(javaRoot, packageToPath(config.identity.packageName));
  if (config.identity.packageName !== OLD_PACKAGE) {
    if (!existsSync(oldDir)) {
      warnings.push(`kotlin: ${oldDir} not found, skipped package rename`);
    } else {
      await mkdir(newDir, { recursive: true });
      for (const file of await readdir(oldDir)) {
        const from = join(oldDir, file);
        const to = join(newDir, file);
        await edit(from, (c) =>
          patchKotlinPackage(c, { oldPackage: OLD_PACKAGE, newPackage: config.identity.packageName }),
        );
        await rename(from, to);
      }
      await pruneEmptyDirs(javaRoot, oldDir);
    }
  }
}

/**
 * iOS patching: bundle id, display name, version, usage strings, and — via the
 * `xcode` pbxproj parser — adding the Swift bridge files to the target and
 * setting the bridging header, so the project compiles without opening Xcode
 * (a macOS CI runner is enough — see .github/workflows/ios.yml).
 */
async function patchIos(outDir: string, config: ResolvedAppcaskConfig): Promise<void> {
  const iosDir = join(outDir, 'ios');
  if (!existsSync(iosDir)) return;
  const pbxPath = join(iosDir, 'AppcaskShell.xcodeproj', 'project.pbxproj');

  await edit(pbxPath, (c) =>
    c
      .replace(
        /PRODUCT_BUNDLE_IDENTIFIER = "[^"]*";/g,
        `PRODUCT_BUNDLE_IDENTIFIER = "${config.identity.packageName}";`,
      )
      .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${config.identity.version};`),
  );

  wireXcodeBridge(pbxPath);

  await edit(join(iosDir, 'AppcaskShell', 'Info.plist'), (plist) => {
    let out = plist.replace(
      /(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]*(<\/string>)/,
      `$1${config.identity.appName}$2`,
    );
    const usage = `\t<key>NSCameraUsageDescription</key>
\t<string>Take a photo to upload.</string>
\t<key>NSPhotoLibraryUsageDescription</key>
\t<string>Choose a photo to upload.</string>
\t<key>NSPhotoLibraryAddUsageDescription</key>
\t<string>Save downloaded files to your library.</string>
`;
    if (!out.includes('NSCameraUsageDescription')) {
      out = out.replace('</dict>\n</plist>', `${usage}</dict>\n</plist>`);
    }
    return out;
  });
}

/** Add AppcaskNative.swift / .mm to the app target and set the bridging header. */
function wireXcodeBridge(pbxPath: string): void {
  if (!existsSync(pbxPath)) return;
  if (readFileSync(pbxPath, 'utf8').includes('AppcaskNative.swift')) return; // already wired
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proj: any = xcode.project(pbxPath);
    proj.parseSync();

    const target = proj.getFirstTarget().uuid;
    const groups = proj.hash.project.objects.PBXGroup as Record<string, { name?: string; path?: string }>;
    const appGroup = Object.keys(groups).find(
      (k) => !k.endsWith('_comment') && (groups[k]?.name === 'AppcaskShell' || groups[k]?.path === 'AppcaskShell'),
    );

    proj.addSourceFile('AppcaskShell/AppcaskNative.swift', { target }, appGroup);
    proj.addSourceFile('AppcaskShell/AppcaskNative.mm', { target }, appGroup);
    proj.addHeaderFile('AppcaskShell/AppcaskShell-Bridging-Header.h', {}, appGroup);
    proj.updateBuildProperty('SWIFT_OBJC_BRIDGING_HEADER', '"AppcaskShell/AppcaskShell-Bridging-Header.h"');
    proj.updateBuildProperty('SWIFT_VERSION', '5.0');
    proj.updateBuildProperty('CLANG_ENABLE_MODULES', 'YES');

    writeFileSync(pbxPath, proj.writeSync());
  } catch {
    // Leave the project as-is; docs/ios.md covers the manual steps.
  }
}

const FIREBASE_VERSION = '^23.4.1';
const GOOGLE_SERVICES_PLUGIN = '4.4.3';

const REAL_PUSH_TS = `import { PermissionsAndroid, Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { config } from '../config';

// Wired by \`appcask android\` (features.push + google-services.json present).
const PARAM = config.features.push?.onTapUrlParam ?? 'url';
export const pushEnabled = true;

// react-native-firebase warns without a foreground handler; the site shows its own UI.
messaging().onMessage(async () => {});

export async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
    const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    if (res !== PermissionsAndroid.RESULTS.GRANTED) return false;
  }
  const status = await messaging().requestPermission();
  return (
    status === messaging.AuthorizationStatus.AUTHORIZED ||
    status === messaging.AuthorizationStatus.PROVISIONAL
  );
}

export async function getToken(): Promise<string | null> {
  try {
    return await messaging().getToken();
  } catch {
    return null;
  }
}

export function onNotificationTapUrl(cb: (url: string) => void): () => void {
  const open = (msg: { data?: Record<string, string | undefined> } | null) => {
    const url = msg?.data?.[PARAM];
    if (typeof url === 'string' && /^https:\\/\\//.test(url)) cb(url);
  };
  void messaging().getInitialNotification().then(open);
  return messaging().onNotificationOpenedApp(open);
}
`;

async function patchPush(
  outDir: string,
  configRoot: string,
  config: ResolvedAppcaskConfig,
  warnings: string[],
): Promise<void> {
  if (!config.features.push) return;
  const googleServices = join(configRoot, 'google-services.json');
  if (!existsSync(googleServices)) {
    warnings.push('features.push is set but google-services.json is not next to the config — push left disabled');
    return;
  }

  await cp(googleServices, join(outDir, 'android', 'app', 'google-services.json'));

  await edit(join(outDir, 'android', 'build.gradle'), (c) =>
    c.includes('com.google.gms:google-services')
      ? c
      : c.replace(
          /(dependencies\s*\{)/,
          `$1\n        classpath("com.google.gms:google-services:${GOOGLE_SERVICES_PLUGIN}")`,
        ),
  );
  await edit(join(outDir, 'android', 'app', 'build.gradle'), (c) =>
    c.includes('com.google.gms.google-services')
      ? c
      : c.replace(
          'apply plugin: "com.facebook.react"',
          'apply plugin: "com.facebook.react"\napply plugin: "com.google.gms.google-services"',
        ),
  );

  const pkgPath = join(outDir, 'package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8')) as { dependencies?: Record<string, string> };
  pkg.dependencies = {
    ...pkg.dependencies,
    '@react-native-firebase/app': FIREBASE_VERSION,
    '@react-native-firebase/messaging': FIREBASE_VERSION,
  };
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

  await writeFile(join(outDir, 'src', 'shell', 'push.ts'), REAL_PUSH_TS, 'utf8');
}

async function writeIcons(
  outDir: string,
  configRoot: string,
  config: ResolvedAppcaskConfig,
  warnings: string[],
): Promise<boolean> {
  const assets = join(configRoot, 'assets');
  const icon = join(assets, 'icon.png');
  if (!existsSync(icon)) {
    warnings.push('assets/icon.png not found — kept the template placeholder icons');
    return false;
  }
  const res = join(outDir, 'android', 'app', 'src', 'main', 'res');
  await generateAndroidIcons(res, {
    icon,
    foreground: join(assets, 'icon-foreground.png'),
    splash: firstExisting([
      join(assets, 'splash-logo.png'),
      join(assets, 'splash.png'),
    ]),
    backgroundColor: config.theme.splash?.background ?? '#ffffff',
  });
  await generatePlayStoreIcon(icon, join(outDir, 'play-store-icon.png'));
  return true;
}

async function edit(path: string, fn: (content: string) => string): Promise<void> {
  if (!existsSync(path)) return;
  const before = await readFile(path, 'utf8');
  const after = fn(before);
  if (after !== before) await writeFile(path, after, 'utf8');
}

async function pruneEmptyDirs(stopAt: string, dir: string): Promise<void> {
  let current = dir;
  while (current !== stopAt && current.length > stopAt.length) {
    try {
      const entries = await readdir(current);
      if (entries.length > 0) break;
      await rm(current, { recursive: true, force: true });
    } catch {
      break;
    }
    current = current.slice(0, current.lastIndexOf('/'));
  }
}

function firstExisting(paths: string[]): string | undefined {
  return paths.find((p) => existsSync(p));
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
