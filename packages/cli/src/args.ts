/** Minimal flag parser: `--flag`, `--flag=value`, `--flag value`, `-x`, and positionals. */
export interface ParsedArgs {
  positionals: string[];
  flags: Record<string, string | boolean>;
}

export function parseArgs(argv: string[], booleanFlags: readonly string[] = []): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  const boolset = new Set(booleanFlags);

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] as string;
    if (arg === '--') {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (arg.startsWith('--')) {
      const body = arg.slice(2);
      const eq = body.indexOf('=');
      if (eq !== -1) {
        flags[body.slice(0, eq)] = body.slice(eq + 1);
      } else if (boolset.has(body)) {
        flags[body] = true;
      } else {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('-')) {
          flags[body] = next;
          i += 1;
        } else {
          flags[body] = true;
        }
      }
    } else if (arg.startsWith('-') && arg.length > 1) {
      for (const ch of arg.slice(1)) flags[ch] = true;
    } else {
      positionals.push(arg);
    }
  }

  return { positionals, flags };
}

export function flagBool(flags: Record<string, string | boolean>, ...names: string[]): boolean {
  return names.some((n) => flags[n] === true || flags[n] === 'true');
}

export function flagStr(
  flags: Record<string, string | boolean>,
  ...names: string[]
): string | undefined {
  for (const n of names) {
    const v = flags[n];
    if (typeof v === 'string') return v;
  }
  return undefined;
}
