import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

/** density bucket -> multiplier over the mdpi baseline */
const DENSITIES: Record<string, number> = {
  mdpi: 1,
  hdpi: 1.5,
  xhdpi: 2,
  xxhdpi: 3,
  xxxhdpi: 4,
};

const LEGACY_DP = 48; // square launcher icon baseline
const ADAPTIVE_DP = 108; // adaptive-icon layer baseline

export interface IconInputs {
  /** Full-bleed square source, ideally 1024×1024, opaque. Required. */
  icon: string;
  /** Transparent adaptive-icon foreground (icon centred in a ~66dp safe zone). Optional. */
  foreground?: string;
  /** Reserved for a custom splash logo (not wired yet — the launcher icon is used). */
  splash?: string;
  /** `#rrggbb` behind the adaptive icon. */
  backgroundColor: string;
}

/**
 * Generate every Android launcher / adaptive / Play Store / splash asset under
 * `resDir` (`android/app/src/main/res`). Returns the paths written.
 */
export async function generateAndroidIcons(resDir: string, inputs: IconInputs): Promise<string[]> {
  const written: string[] = [];
  const put = async (rel: string, buf: Buffer) => {
    const abs = join(resDir, rel);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, buf);
    written.push(rel);
  };

  const bg = normalizeHex(inputs.backgroundColor);
  const foregroundSrc = inputs.foreground && existsSync(inputs.foreground) ? inputs.foreground : null;

  for (const [density, mult] of Object.entries(DENSITIES)) {
    const legacy = Math.round(LEGACY_DP * mult);
    const adaptive = Math.round(ADAPTIVE_DP * mult);

    const square = await sharp(inputs.icon).resize(legacy, legacy, { fit: 'cover' }).png().toBuffer();
    await put(`mipmap-${density}/ic_launcher.png`, square);
    await put(`mipmap-${density}/ic_launcher_round.png`, await circleMask(square, legacy));

    // adaptive foreground: use the dedicated source, or inset the full-bleed icon
    // into the ~66/108 safe zone on a transparent canvas.
    const fg = foregroundSrc
      ? await sharp(foregroundSrc).resize(adaptive, adaptive, { fit: 'contain', background: TRANSPARENT }).png().toBuffer()
      : await insetOnCanvas(inputs.icon, adaptive, 0.62);
    await put(`mipmap-${density}/ic_launcher_foreground.png`, fg);
    await put(`mipmap-${density}/ic_launcher_background.png`, await solid(adaptive, bg));
  }

  await put('mipmap-anydpi-v26/ic_launcher.xml', Buffer.from(ADAPTIVE_XML, 'utf8'));
  await put('mipmap-anydpi-v26/ic_launcher_round.xml', Buffer.from(ADAPTIVE_XML, 'utf8'));

  return written;
}

/** The 512×512 opaque icon for the Play Store listing. */
export async function generatePlayStoreIcon(iconSrc: string, destPath: string): Promise<void> {
  await mkdir(dirname(destPath), { recursive: true });
  await writeFile(destPath, await sharp(iconSrc).resize(512, 512, { fit: 'cover' }).flatten().png().toBuffer());
}

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

const ADAPTIVE_XML = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`;

async function solid(size: number, hex: string): Promise<Buffer> {
  const { r, g, b } = hexToRgb(hex);
  return sharp({ create: { width: size, height: size, channels: 4, background: { r, g, b, alpha: 1 } } })
    .png()
    .toBuffer();
}

async function insetOnCanvas(src: string, size: number, scale: number): Promise<Buffer> {
  const inner = Math.round(size * scale);
  const logo = await sharp(src).resize(inner, inner, { fit: 'contain', background: TRANSPARENT }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: TRANSPARENT } })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toBuffer();
}

async function circleMask(square: Buffer, size: number): Promise<Buffer> {
  const r = size / 2;
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/></svg>`,
  );
  return sharp(square)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

function normalizeHex(hex: string): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(hex.trim());
  if (!m) return '#ffffff';
  let h = m[1] as string;
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return '#' + h.slice(0, 6).toLowerCase();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(normalizeHex(hex).slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
