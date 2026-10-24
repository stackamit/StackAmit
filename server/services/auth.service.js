import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// SA-016: pin the signing/verification algorithm to a single HMAC-SHA256 so a
// token cannot be accepted under a different (e.g. "none" or RS*) algorithm.
const JWT_ALGORITHM = 'HS256';

// SA-020: the refresh cookie is only needed by the refresh + logout endpoints,
// both under /api/auth. The previous value (/api/auth/refresh) did NOT path-match
// /api/auth/refresh-token under RFC 6265, so the browser never replayed the
// refresh cookie and silent session renewal silently failed.
export const AUTH_COOKIE_PATH = '/api/auth';
export const ACCESS_COOKIE_PATH = '/';

// SA-021: refresh tokens are stored as a SHA-256 digest, never the raw JWT.
// Hashing (not encryption) is one-way and fast; a stolen DB dump yields no
// usable token. Pure + exported so it can be unit-verified without a DB.
export const hashToken = (token) =>
  typeof token === 'string' && token.length > 0
    ? crypto.createHash('sha256').update(token).digest('hex')
    : null;

// Backward-compatible verification: new records store only the digest; legacy
// records may still hold the raw token until they log in again or are migrated.
// Returns true when the presented token matches the stored digest, or - for a
// not-yet-migrated record - matches the stored plaintext exactly.
export const isRefreshTokenValid = (user, presentedToken) => {
  if (!user || typeof presentedToken !== 'string' || presentedToken.length === 0) {
    return false;
  }
  if (user.refreshTokenHash) {
    return user.refreshTokenHash === hashToken(presentedToken);
  }
  return !!user.refreshToken && user.refreshToken === presentedToken;
};

export const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { algorithm: JWT_ALGORITHM, expiresIn: process.env.JWT_EXPIRE || '15m' }
  );
};

export const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { algorithm: JWT_ALGORITHM, expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );
};

export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET, { algorithms: [JWT_ALGORITHM] });
  } catch (error) {
    return null;
  }
};

export const generateTempPassword = (length = 14) => {
  // SA-028: a CSPRNG password with guaranteed character classes instead of the
  // previous alphanumeric-only, entropy-truncated value. Ambiguous glyphs
  // (0/O/1/l/I) are excluded so it can be read over the phone / typed reliably.
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*()-_=+';
  const all = upper + lower + digits + symbols;
  const pick = (set) => set[crypto.randomInt(set.length)];
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (chars.length < length) chars.push(pick(all));
  // Fisher-Yates shuffle with crypto random so required classes are not ordered.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};

export const setTokenCookies = (res, accessToken, refreshToken) => {
  const isProd = process.env.NODE_ENV === 'production';

  // SA-020: httpOnly first-party carrier for the access token (path '/' so it
  // is sent to every protected API route - this is what enables cookie-only
  // auth and lets us stop persisting the access token in localStorage).
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    path: ACCESS_COOKIE_PATH,
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'strict' : 'lax',
    path: AUTH_COOKIE_PATH,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

export const clearTokenCookies = (res) => {
  res.clearCookie('accessToken', { path: ACCESS_COOKIE_PATH });
  res.clearCookie('refreshToken', { path: AUTH_COOKIE_PATH });
};
