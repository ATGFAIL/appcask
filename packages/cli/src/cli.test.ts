import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs, flagBool, flagStr } from './args.js';
import { readPngInfo } from './png.js';
import { findConfig, loadProject } from './project.js';

describe('parseArgs', () => {
  it('splits positionals and flags', () => {
    const r = parseArgs(['init', 'my-app', '--yes', '--name', 'Acme'], ['yes']);
    expect(r.positionals).toEqual(['init', 'my-app']);
    expect(r.flags).toEqual({ yes: true, name: 'Acme' });
  });

  it('handles --flag=value', () => {
    const r = parseArgs(['doctor', '--timeout=5'], []);
    expect(r.flags.timeout).toBe('5');
  });

  it('treats a listed boolean flag as boolean even with a following word', () => {
    const r = parseArgs(['build', '--offline', 'android'], ['offline']);
    expect(r.flags.offline).toBe(true);
    expect(r.positionals).toEqual(['build', 'android']);
  });

  it('stops flag parsing at --', () => {
    const r = parseArgs(['x', '--', '--not-a-flag'], []);
    expect(r.positionals).toEqual(['x', '--not-a-flag']);
  });

  it('flagBool / flagStr helpers', () => {
    const { flags } = parseArgs(['--force', '--url', 'https://x'], ['force']);
    expect(flagBool(flags, 'force')).toBe(true);
    expect(flagBool(flags, 'missing')).toBe(false);
    expect(flagStr(flags, 'url')).toBe('https://x');
  });
});

/** A valid PNG: 8-byte signature + a complete IHDR chunk for a WxH RGBA image. */
function fakePng(width: number, height: number, colorType = 6): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0); // length
  ihdr.write('IHDR', 4, 'ascii');
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr.writeUInt8(8, 16); // bit depth
  ihdr.writeUInt8(colorType, 17);
  return Buffer.concat([sig, ihdr, Buffer.alloc(8)]);
}

describe('readPngInfo', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'appcask-png-'));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('reads dimensions and alpha from IHDR', async () => {
    const p = join(dir, 'a.png');
    await writeFile(p, fakePng(1024, 1024, 6));
    expect(await readPngInfo(p)).toMatchObject({ width: 1024, height: 1024, hasAlpha: true });
  });

  it('reports no alpha for colour type 2', async () => {
    const p = join(dir, 'b.png');
    await writeFile(p, fakePng(512, 256, 2));
    const info = await readPngInfo(p);
    expect(info).toMatchObject({ width: 512, height: 256, hasAlpha: false });
  });

  it('throws on a non-PNG', async () => {
    const p = join(dir, 'c.png');
    await writeFile(p, Buffer.from('not a png at all really'));
    await expect(readPngInfo(p)).rejects.toThrow(/not a PNG/);
  });
});

describe('project loading', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'appcask-proj-'));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('findConfig walks up the tree', async () => {
    await writeFile(
      join(dir, 'appcask.config.json'),
      JSON.stringify({ identity: { appName: 'X', packageName: 'com.x.y', version: '1.0.0' }, startUrl: 'https://x.example' }),
    );
    const nested = join(dir, 'a', 'b');
    await mkdir(nested, { recursive: true });
    expect(findConfig(nested)).toBe(join(dir, 'appcask.config.json'));
  });

  it('loadProject resolves defaults', async () => {
    await writeFile(
      join(dir, 'appcask.config.json'),
      JSON.stringify({ identity: { appName: 'X', packageName: 'com.x.y', version: '1.0.0' }, startUrl: 'https://x.example/home' }),
    );
    const project = await loadProject(dir);
    expect(project.config.internalHosts).toEqual(['x.example']);
    expect(project.config.features.offlinePage).toBe(true);
  });

  it('loadProject throws a readable error on an invalid config', async () => {
    await writeFile(join(dir, 'appcask.config.json'), JSON.stringify({ startUrl: 'http://insecure' }));
    await expect(loadProject(dir)).rejects.toThrow(/Invalid appcask config/);
  });

  it('loadProject throws on malformed JSON', async () => {
    await writeFile(join(dir, 'appcask.config.json'), '{ not json');
    await expect(loadProject(dir)).rejects.toThrow(/not valid JSON/);
  });
});

describe('init command (end to end)', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'appcask-init-'));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('writes a valid config with --yes', async () => {
    const { initCommand } = await import('./commands/init.js');
    await initCommand({ dir, force: false, yes: true, name: 'Acme', url: 'https://acme.example', packageName: 'com.acme.app' });
    const written = JSON.parse(await readFile(join(dir, 'appcask.config.json'), 'utf8'));
    expect(written.identity).toEqual({ appName: 'Acme', packageName: 'com.acme.app', version: '1.0.0' });
    expect(written.internalHosts).toEqual(['acme.example']);
    // and it round-trips through the loader
    const project = await loadProject(dir);
    expect(project.config.startUrl).toBe('https://acme.example');
  });

  it('refuses to overwrite without --force', async () => {
    const { initCommand } = await import('./commands/init.js');
    await initCommand({ dir, force: false, yes: true });
    await expect(initCommand({ dir, force: false, yes: true })).rejects.toThrow(/already exists/);
  });
});
