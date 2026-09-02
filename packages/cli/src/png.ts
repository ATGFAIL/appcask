import { readFile } from 'node:fs/promises';

export interface PngInfo {
  width: number;
  height: number;
  /** Colour type from the IHDR chunk: 6 = RGBA, 2 = RGB, 3 = palette, 0 = grey, 4 = grey+alpha. */
  colorType: number;
  hasAlpha: boolean;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Read a PNG's dimensions straight from the IHDR chunk — no image library.
 * Throws if the file is not a PNG.
 */
export async function readPngInfo(path: string): Promise<PngInfo> {
  const buf = await readFile(path);
  if (buf.length < 33 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`${path} is not a PNG`);
  }
  // bytes 8..12 length, 12..16 "IHDR", 16..20 width, 20..24 height, 24 bit depth, 25 colour type
  if (buf.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error(`${path}: malformed PNG (no IHDR)`);
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const colorType = buf.readUInt8(25);
  return { width, height, colorType, hasAlpha: colorType === 4 || colorType === 6 };
}
