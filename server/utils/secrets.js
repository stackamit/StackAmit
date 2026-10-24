// ─────────────────────────────────────────────────────────────
// SA-037: secret-configuration checks.
//
// cookieParser(secret) only matters when *signed* cookies are used. This app
// issues httpOnly cookies that already carry a signed JWT and never calls
// req.signedCookies, so the cookie secret is effectively unused - but if it is
// ever reused as (or equal to) a JWT secret, a single leaked value would break
// both layers. These pure helpers describe the risk so it can be surfaced at
// boot and unit-verified without starting the server.
// ─────────────────────────────────────────────────────────────

/**
 * @returns {{missing:boolean, reused:boolean, advice:string}}
 */
export const evaluateCookieSecret = ({ cookieSecret, jwtSecret, jwtRefreshSecret } = {}) => {
  const cs = typeof cookieSecret === 'string' ? cookieSecret.trim() : '';
  const missing = cs.length === 0;
  const reused =
    !missing &&
    ((typeof jwtSecret === 'string' && cs === jwtSecret) ||
      (typeof jwtRefreshSecret === 'string' && cs === jwtRefreshSecret));

  let advice = '';
  if (missing) {
    advice =
      'COOKIE_SECRET is unset. It is only required if req.signedCookies is used; current code signs cookies with JWTs, so this is non-fatal, but set a distinct value before enabling signed cookies.';
  } else if (reused) {
    advice =
      'COOKIE_SECRET must NOT equal JWT_SECRET or JWT_REFRESH_SECRET. Keep them independent so one leaked secret cannot compromise both cookie integrity and token signing.';
  }

  return { missing, reused, advice };
};
