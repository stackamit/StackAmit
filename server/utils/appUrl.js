// ─────────────────────────────────────────────────────────────
// SA-035: canonical client (front-end) base URL for generated links.
//
// CLIENT_URL is also used as a comma-separated CORS/socket allow-list for
// multi-origin deployments. Email + certificate verification links, however,
// must be built against a *single* origin - embedding "https://a,https://b"
// produces a broken, un-clickable link. This resolver picks the first
// configured origin, trims trailing slashes, and falls back to the production
// Netlify origin when nothing usable is set.
// ─────────────────────────────────────────────────────────────

export const DEFAULT_CLIENT_ORIGIN = 'https://stackamit.netlify.app';

export const getClientBaseUrl = () => {
  const raw = process.env.CLIENT_URL;
  if (typeof raw !== 'string' || raw.trim() === '') return DEFAULT_CLIENT_ORIGIN;
  const first = raw.split(',').map((o) => o.trim()).filter(Boolean)[0];
  if (!first) return DEFAULT_CLIENT_ORIGIN;
  return first.replace(/\/+$/, '');
};
