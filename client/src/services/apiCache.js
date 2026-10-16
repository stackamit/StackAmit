// ─────────────────────────────────────────────
// Browser Cache for API GET Responses
//
// Stores temporary copies of relatively static API data in
// localStorage so repeat page loads render instantly without
// hitting the network. Entries:
//   - expire automatically (TTL per endpoint group)
//   - are scoped per logged-in user (never shared between accounts)
//   - are invalidated when a matching mutation (POST/PUT/PATCH/DELETE) succeeds
//   - survive page reloads until the user clears browser data
// ─────────────────────────────────────────────

const STORAGE_PREFIX = 'sa_api_';

// Which GET endpoints are cacheable and for how long.
// Anything not listed (notifications, unread counts, etc.) always
// goes straight to the network.
const CACHE_RULES = [
  { pattern: /^\/internships(\?|\/|$)/, ttl: 3 * 60 * 1000 },      // 3 min
  { pattern: /^\/articles(\?|\/|$)/, ttl: 3 * 60 * 1000 },          // 3 min
  { pattern: /^\/certificates(\?|\/|$)/, ttl: 2 * 60 * 1000 },      // 2 min
  { pattern: /^\/students(\?|\/|$)/, ttl: 2 * 60 * 1000 },          // 2 min
  { pattern: /^\/trainers(\?|\/|$)/, ttl: 5 * 60 * 1000 },          // 5 min
  { pattern: /^\/settings(\?|\/|$)/, ttl: 10 * 60 * 1000 },         // 10 min
];

// ─── Helpers ─────────────────────────────────

const getCurrentUserId = () => {
  try {
    const raw = localStorage.getItem('user');
    if (raw) {
      const u = JSON.parse(raw);
      return u?._id || 'anon';
    }
  } catch { /* ignore */ }
  return 'anon';
};

// Extract the API path (drop baseURL + query string)
const getPath = (url = '') => url.replace(/^.*\/api/, '').split('?')[0];

// Extract the first resource segment, e.g. "/internships/public" -> "internships"
const getResource = (url = '') => {
  const path = getPath(url);
  const seg = path.replace(/^\//, '').split('/')[0];
  return seg || '';
};

export const getCacheTtl = (url) => {
  const path = getPath(url);
  const rule = CACHE_RULES.find(r => r.pattern.test(path));
  return rule ? rule.ttl : null;
};

const buildKey = (url, params) => {
  const path = getPath(url);
  const paramStr = params ? JSON.stringify(params, Object.keys(params).sort()) : '';
  return `${STORAGE_PREFIX}${getCurrentUserId()}::${path}::${paramStr}`;
};

// ─── Storage Operations ──────────────────────

const safeParseItems = () => {
  const entries = [];
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
    keys.push(key);
    try {
      entries.push(JSON.parse(localStorage.getItem(key)));
    } catch {
      entries.push(null);
    }
  }
  return { keys, entries };
};

// Remove expired entries (and any corrupted ones)
export const pruneExpiredCache = () => {
  try {
    const { keys, entries } = safeParseItems();
    const now = Date.now();
    keys.forEach((key, i) => {
      const entry = entries[i];
      if (!entry || !entry.expiresAt || entry.expiresAt < now) {
        localStorage.removeItem(key);
      }
    });
  } catch { /* ignore */ }
};

// Run a prune whenever the module loads (once per tab session)
pruneExpiredCache();

/**
 * Read a fresh cache entry. Returns a synthetic axios-like response
 * object, or null on miss/expiry.
 */
export const readCacheEntry = (url, params) => {
  try {
    const raw = localStorage.getItem(buildKey(url, params));
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || Date.now() > entry.expiresAt) {
      localStorage.removeItem(buildKey(url, params));
      return null;
    }
    return {
      data: entry.data,
      status: 200,
      statusText: 'OK',
      headers: {},
      config: entry.config || { url },
      fromCache: true,
    };
  } catch {
    return null;
  }
};

/**
 * Persist a GET response body in localStorage.
 * Silently no-ops when the value is too large or storage is full.
 */
export const writeCacheEntry = (url, params, data, ttl) => {
  try {
    const serialized = JSON.stringify(data);
    // Skip oversized payloads (avoid blowing the localStorage quota)
    if (serialized.length > 512 * 1024) return;
    const entry = {
      data,
      resource: getResource(url),
      expiresAt: Date.now() + ttl,
      config: { url },
    };
    localStorage.setItem(buildKey(url, params), JSON.stringify(entry));
  } catch {
    // Most likely a quota error - prune and move on without caching
    pruneExpiredCache();
  }
};

/**
 * Invalidate every cached GET whose resource segment matches the
 * mutated resource (e.g. a PATCH on /applications/x clears cached
 * /applications GETs for the current user).
 */
export const invalidateResource = (url) => {
  try {
    const resource = getResource(url);
    if (!resource) return;
    const userId = getCurrentUserId();
    // Key shape: sa_api_<userId>::/<resource>[/sub]::params
    const pathPrefix = `${userId}::/${resource}`;
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
      const body = key.slice(STORAGE_PREFIX.length);
      if (!body.startsWith(pathPrefix)) continue;
      // Boundary check so "/internshipX" never matches resource "internship"
      const next = body[pathPrefix.length];
      if (next === undefined || next === '/' || next === ':') {
        keys.push(key);
      }
    }
    keys.forEach(k => localStorage.removeItem(k));
  } catch { /* ignore */ }
};

/** Clear all cached API data (e.g. on logout). */
export const clearApiCache = () => {
  try {
    const userId = getCurrentUserId();
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`${STORAGE_PREFIX}${userId}`)) keys.push(key);
    }
    keys.forEach(k => localStorage.removeItem(k));
  } catch { /* ignore */ }
};
