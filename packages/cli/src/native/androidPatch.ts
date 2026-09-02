import type { ResolvedAppcaskConfig } from '@appcask/config';

/** `com.acme.shop` -> `com/acme/shop` */
export function packageToPath(pkg: string): string {
  return pkg.replace(/\./g, '/');
}

/** `1.4.2` -> `10402`. Monotonic as long as minor/patch stay < 100. */
export function androidVersionCode(version: string): number {
  const [maj = '0', min = '0', patch = '0'] = version.split('.');
  return Number(maj) * 10_000 + Number(min) * 100 + Number(patch);
}

export function patchBuildGradle(
  content: string,
  opts: { oldPackage: string; packageName: string; version: string },
): string {
  const code = androidVersionCode(opts.version);
  return content
    .replace(new RegExp(`namespace ".*?"`), `namespace "${opts.packageName}"`)
    .replace(new RegExp(`applicationId ".*?"`), `applicationId "${opts.packageName}"`)
    .replace(/versionCode \d+/, `versionCode ${code}`)
    .replace(/versionName ".*?"/, `versionName "${opts.version}"`);
}

export function patchStringsXml(
  content: string,
  opts: { appName: string; deeplinkHost: string; shareUrl?: string },
): string {
  return content
    .replace(
      /(<string name="app_name">)[^<]*(<\/string>)/,
      `$1${escapeXml(opts.appName)}$2`,
    )
    .replace(
      /(<string name="appcask_deeplink_host">)[^<]*(<\/string>)/,
      `$1${escapeXml(opts.deeplinkHost)}$2`,
    )
    .replace(
      /(<string name="appcask_share_url">)[^<]*(<\/string>)/,
      `$1${escapeXml(opts.shareUrl ?? '')}$2`,
    );
}

const SHARE_INTENT_FILTER = `        <intent-filter>
            <action android:name="android.intent.action.SEND" />
            <category android:name="android.intent.category.DEFAULT" />
            <data android:mimeType="text/plain" />
        </intent-filter>`;

/** Add the ACTION_SEND intent-filter to MainActivity when features.shareTarget is set. */
export function patchManifestShareTarget(content: string, enabled: boolean): string {
  const has = content.includes('android.intent.action.SEND');
  if (enabled && !has) {
    return content.replace(
      /(\n\s*<\/activity>)/,
      `\n\n${SHARE_INTENT_FILTER}$1`,
    );
  }
  if (!enabled && has) {
    return content.replace(/\s*<intent-filter>(?:(?!<\/intent-filter>)[\s\S])*?android\.intent\.action\.SEND[\s\S]*?<\/intent-filter>/, '');
  }
  return content;
}

export function patchAppJson(content: string, opts: { appName: string }): string {
  const json = JSON.parse(content) as { name?: string; displayName?: string };
  // `name` is the AppRegistry key (must match MainActivity.getMainComponentName) — keep it.
  json.name = json.name ?? 'AppcaskShell';
  json.displayName = opts.appName;
  return JSON.stringify(json, null, 2) + '\n';
}

/** Rewrite `package com.appcaskshell` and every `com.appcaskshell.` reference. */
export function patchKotlinPackage(
  content: string,
  opts: { oldPackage: string; newPackage: string },
): string {
  const oldEsc = opts.oldPackage.replace(/\./g, '\\.');
  return content
    .replace(new RegExp(`(^|\\n)package ${oldEsc}\\b`), `$1package ${opts.newPackage}`)
    .replace(new RegExp(`\\b${oldEsc}\\.`, 'g'), `${opts.newPackage}.`);
}

/** `android/app/src/main/res/values/colors.xml` */
export function colorsXml(config: ResolvedAppcaskConfig): string {
  const status = config.theme.statusBar.color ?? '#000000';
  const nav = config.theme.navigationBarColor ?? status;
  const splash = config.theme.splash?.background ?? '#ffffff';
  return `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="appcask_status_bar">${status}</color>
    <color name="appcask_navigation_bar">${nav}</color>
    <color name="appcask_splash_background">${splash}</color>
</resources>
`;
}

/**
 * Drop permissions the config doesn't need, so they don't show on the store
 * listing. The template declares CAMERA (file capture) and WRITE_EXTERNAL_STORAGE
 * (downloads on old Android).
 */
export function patchManifestPermissions(
  content: string,
  opts: { fileAccess: boolean; downloads: boolean },
): string {
  let out = content;
  if (!opts.fileAccess) {
    out = out.replace(/^.*android\.permission\.CAMERA.*\n?/m, '');
  }
  if (!opts.downloads) {
    out = out.replace(/^.*android\.permission\.WRITE_EXTERNAL_STORAGE.*\n?/m, '');
  }
  return out;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** `features.deepLinks.host`, else the first internal host, else `example.com`. */
export function deeplinkHost(config: ResolvedAppcaskConfig): string {
  return config.features.deepLinks?.host ?? config.internalHosts[0] ?? 'example.com';
}
