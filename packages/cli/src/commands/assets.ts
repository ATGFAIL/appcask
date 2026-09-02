import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { loadProject } from '../project.js';
import { readPngInfo } from '../png.js';
import { generateAndroidIcons, generatePlayStoreIcon } from '../native/icons.js';
import { CliError, dim, heading, info, line, ok, warn } from '../ui.js';

interface AssetsFlags {
  /** Where to write the generated preview. Default `.appcask/android-res`. */
  out?: string;
}

export async function assetsCommand(flags: AssetsFlags): Promise<void> {
  const { root, config } = await loadProject();
  const assets = join(root, 'assets');
  const iconPath = join(assets, 'icon.png');

  heading('appcask assets');

  if (!existsSync(iconPath)) {
    throw new CliError(
      `assets/icon.png not found.\n` +
        `  Add a 1024×1024 opaque PNG at ${iconPath} — everything is generated from it.`,
    );
  }

  const iconInfo = await readPngInfo(iconPath).catch(() => null);
  if (!iconInfo) throw new CliError('assets/icon.png is not a valid PNG');
  if (iconInfo.width !== iconInfo.height) warn(`icon.png is not square (${iconInfo.width}×${iconInfo.height})`);
  if (iconInfo.width < 512) warn(`icon.png is only ${iconInfo.width}px — 1024 is recommended`);
  if (iconInfo.hasAlpha) warn('icon.png has transparency — store icons should be opaque');
  ok(`source icon: assets/icon.png (${iconInfo.width}×${iconInfo.width})`);

  const fg = join(assets, 'icon-foreground.png');
  if (existsSync(fg)) ok('adaptive foreground: assets/icon-foreground.png');
  else info('no assets/icon-foreground.png — the full-bleed icon is inset for the adaptive layer');

  const splash = ['splash-logo.png', 'splash.png'].map((f) => join(assets, f)).find(existsSync);
  if (splash) ok(`splash logo: assets/${splash.split('/').pop()}`);
  else info('no assets/splash-logo.png — the app icon is used on the splash screen');

  const outDir = flags.out ? join(root, flags.out) : join(root, '.appcask', 'android-res');
  await rm(outDir, { recursive: true, force: true });

  const written = await generateAndroidIcons(outDir, {
    icon: iconPath,
    foreground: fg,
    splash: splash ?? iconPath,
    backgroundColor: config.theme.splash?.background ?? '#ffffff',
  });
  await generatePlayStoreIcon(iconPath, join(outDir, 'play-store-icon.png'));

  heading('Generated');
  line(`  ${written.length + 1} files → ${dim(rel(root, outDir))}`);
  info('mipmap-{m,h,x,xx,xxx}dpi: ic_launcher, ic_launcher_round, ic_launcher_foreground/background, ic_splash');
  info('mipmap-anydpi-v26: ic_launcher.xml, ic_launcher_round.xml');
  info('play-store-icon.png (512×512)');
  line();
  line(dim('  These are a preview. `appcask android` regenerates them into the project.'));
}

function rel(root: string, p: string): string {
  return p.startsWith(root) ? p.slice(root.length + 1) : p;
}
