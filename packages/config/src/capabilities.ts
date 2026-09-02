import type { CapabilityGrant, CapabilityMatch } from './types.js';

export interface CapabilityDecision {
  allowed: boolean;
  /** Set when `allowed` is false. */
  reason?: string;
}

/**
 * Is `method` allowed to be called from the page at `url`?
 *
 *  - `grants === null` → allowed (the config declared no `bridge.grants`).
 *  - otherwise **default-deny**: allowed only if some grant whose `match`
 *    covers `url` lists the capability (exact, `namespace.*`, or `*`).
 *
 * Pure — string / `URL` only. Runs on the native side of the bridge.
 */
export function checkCapability(
  grants: CapabilityGrant[] | null,
  url: string,
  method: string,
): CapabilityDecision {
  if (grants === null) return { allowed: true };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { allowed: false, reason: `capability check: "${url}" is not a valid URL` };
  }

  for (const grant of grants) {
    if (!matchesScope(grant.match, parsed)) continue;
    if (grant.capabilities.some((cap) => capabilityMatches(cap, method))) {
      return { allowed: true };
    }
  }
  return {
    allowed: false,
    reason: `capability "${method}" is not granted for ${parsed.host}${parsed.pathname}`,
  };
}

/** Every capability the given `url` is allowed — for `doctor` / tooling. */
export function grantedCapabilities(
  grants: CapabilityGrant[] | null,
  url: string,
  allMethods: readonly string[],
): string[] {
  if (grants === null) return [...allMethods];
  return allMethods.filter((m) => checkCapability(grants, url, m).allowed);
}

function capabilityMatches(cap: string, method: string): boolean {
  if (cap === '*' || cap === method) return true;
  if (cap.endsWith('.*')) return method.startsWith(cap.slice(0, -1));
  return false;
}

function matchesScope(match: CapabilityMatch | undefined, url: URL): boolean {
  if (!match) return true;
  if (match.host !== undefined && !hostMatches(url.host, match.host)) return false;
  if (match.pathPrefix !== undefined && !url.pathname.startsWith(match.pathPrefix)) return false;
  if (match.pathGlob !== undefined && !pathMatchesGlob(url.pathname, match.pathGlob)) return false;
  return true;
}

function hostMatches(host: string, pattern: string): boolean {
  const h = host.toLowerCase();
  const p = pattern.toLowerCase();
  return p.startsWith('.') ? h === p.slice(1) || h.endsWith(p) : h === p;
}

/** `*` = one segment, `**` = any; a wildcard-free pattern is a directory prefix. */
function pathMatchesGlob(path: string, pattern: string): boolean {
  const norm = (v: string) => (v.startsWith('/') ? v : '/' + v);
  const pth = norm(path);
  const pat = norm(pattern);
  if (!pat.includes('*')) {
    return pth === pat || pth.startsWith(pat.replace(/\/$/, '') + '/');
  }
  let re = '^';
  for (let i = 0; i < pat.length; i += 1) {
    const ch = pat[i] as string;
    if (ch === '*') {
      if (pat[i + 1] === '*') {
        re += '.*';
        i += 1;
      } else {
        re += '[^/]*';
      }
    } else if ('\\^$.|?+()[]{}'.includes(ch)) {
      re += '\\' + ch;
    } else {
      re += ch;
    }
  }
  return new RegExp(re + '$').test(pth);
}
