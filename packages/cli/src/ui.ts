/** Tiny ANSI helpers — no dependency, honours NO_COLOR and non-TTY output. */

const enabled =
  process.env.NO_COLOR === undefined &&
  process.env.TERM !== 'dumb' &&
  (process.stdout.isTTY ?? false);

const ESC = String.fromCharCode(27);
const wrap = (open: number, close: number) => (s: string) =>
  enabled ? `${ESC}[${open}m${s}${ESC}[${close}m` : s;

export const bold = wrap(1, 22);
export const dim = wrap(2, 22);
export const red = wrap(31, 39);
export const green = wrap(32, 39);
export const yellow = wrap(33, 39);
export const cyan = wrap(36, 39);

export const symbols = {
  ok: green('✓'),
  warn: yellow('⚠'),
  fail: red('✗'),
  info: cyan('•'),
};

export function heading(text: string): void {
  process.stdout.write(`\n${bold(text)}\n`);
}

export function line(text = ''): void {
  process.stdout.write(`${text}\n`);
}

export function ok(text: string): void {
  line(`  ${symbols.ok} ${text}`);
}
export function warn(text: string): void {
  line(`  ${symbols.warn} ${yellow(text)}`);
}
export function fail(text: string): void {
  line(`  ${symbols.fail} ${red(text)}`);
}
export function info(text: string): void {
  line(`  ${symbols.info} ${dim(text)}`);
}

export class CliError extends Error {}
