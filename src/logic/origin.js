// Which parent pages may talk to the room app (postMessage both ways).
// Patterns: exact origin, or "*." wildcard for any subdomain (https only), or localhost on any port.

export const DEFAULT_ALLOWED_ORIGINS = Object.freeze([
  'https://*.wixsite.com',
  'https://*.wix.com', // Wix Editor, Local Editor and site preview
  'https://gingersattic.com',
  'https://www.gingersattic.com',
  'http://localhost:*',
  'http://127.0.0.1:*',
]);

/**
 * @param {string} origin  e.g. "https://ellisonrblair.wixsite.com"
 * @param {readonly string[]} [allowlist]
 */
export function isAllowedOrigin(origin, allowlist = DEFAULT_ALLOWED_ORIGINS) {
  if (typeof origin !== 'string' || origin === 'null' || origin === '') return false;
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.origin !== origin) return false; // reject paths, credentials, trailing slashes
  for (const pattern of allowlist) {
    if (matches(url, pattern)) return true;
  }
  return false;
}

function matches(url, pattern) {
  const m = /^(https?):\/\/(\*\.)?([^:/]+)(?::(\*|\d+))?$/.exec(pattern);
  if (!m) return false;
  const [, scheme, wildcard, host, port] = m;
  if (url.protocol !== `${scheme}:`) return false;
  if (port === '*') {
    // any port, including none
  } else if (port) {
    if (url.port !== port) return false;
  } else if (url.port !== '') {
    return false;
  }
  if (wildcard) return url.hostname.endsWith(`.${host}`) && url.hostname.length > host.length + 1;
  return url.hostname === host;
}
