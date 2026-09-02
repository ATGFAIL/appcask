/**
 * Minimal path-glob matching for `separateDocumentPatterns`.
 *
 *  - `*`  matches any run of characters except `/`
 *  - `**` matches any run of characters including `/`
 *  - a pattern with no wildcard matches that exact path **or** that path used
 *    as a directory prefix (`/admin` matches `/admin` and `/admin/users`)
 *
 * Matching is case-sensitive and anchored to the whole path.
 */
export function pathMatchesGlob(path: string, pattern: string): boolean {
  const normalizedPath = normalize(path);
  const normalizedPattern = normalize(pattern);

  if (!normalizedPattern.includes('*')) {
    return (
      normalizedPath === normalizedPattern ||
      normalizedPath.startsWith(normalizedPattern.replace(/\/$/, '') + '/')
    );
  }

  return globToRegExp(normalizedPattern).test(normalizedPath);
}

export function pathMatchesAnyGlob(path: string, patterns: readonly string[]): boolean {
  return patterns.some((p) => pathMatchesGlob(path, p));
}

function normalize(value: string): string {
  if (!value.startsWith('/')) return '/' + value;
  return value;
}

function globToRegExp(pattern: string): RegExp {
  let out = '^';
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        out += '.*';
        i += 1;
      } else {
        out += '[^/]*';
      }
    } else if ('\\^$.|?+()[]{}'.includes(ch as string)) {
      out += '\\' + ch;
    } else {
      out += ch;
    }
  }
  out += '$';
  return new RegExp(out);
}
