import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { asyncHandler } from './errorHandler.js';

// ─── SA-022: forced password-change gate ─────────────────────────────────────
// These auth endpoints must stay reachable while a user still owes a password
// change, otherwise they could never complete the change (or log out cleanly).
export const PASSWORD_CHANGE_EXEMPT_PATHS = [
  '/auth/change-password',
  '/auth/logout',
  '/auth/me',
  '/auth/refresh-token',
];

export const isPasswordChangeExempt = (path = '') => {
  const clean = String(path).split('?')[0];
  return PASSWORD_CHANGE_EXEMPT_PATHS.some((ex) => clean === ex || clean.endsWith(ex));
};

// Staged-rollout mode from env. Accepts several spellings so ops can flip it
// via a familiar boolean or an explicit rollout keyword.
export const parseEnforceMode = (flag) => {
  const v = String(flag || '').toLowerCase().trim();
  if (['true', '1', 'on', 'enforce', 'enforcing'].includes(v)) return 'enforce';
  if (['warn', 'warn_only', 'warn-only', 'log'].includes(v)) return 'warn';
  return 'off';
};

// Pure decision helper (unit-verifiable without a DB or Express):
//   enforce -> block non-exempt routes
//   warn    -> allow but flag (for shadow rollout / log review)
//   off     -> allow (default; safe first deploy)
export const evaluatePasswordGate = ({ mustChangePassword, path, mode } = {}) => {
  if (!mustChangePassword) return { block: false, warn: false };
  if (mode !== 'warn' && mode !== 'enforce') return { block: false, warn: false };
  if (isPasswordChangeExempt(path)) return { block: false, warn: false };
  if (mode === 'warn') return { block: false, warn: true };
  return { block: true, warn: false };
};

export const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Check Authorization header
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  // Check httpOnly cookie
  else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized - No token provided',
    });
  }

  try {
    // SA-016: pin the accepted algorithm to HS256 (no "none"/RS* substitution).
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized - User not found',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account has been deactivated',
      });
    }

    req.user = user;

    // SA-022: enforce the outstanding forced-password-change restriction.
    // Controlled by ENFORCE_PASSWORD_CHANGE (off | warn | enforce). Default is
    // 'off' so shipping this change can never lock anyone out until ops
    // deliberately enable warn -> enforce after reviewing warn-mode logs.
    const pwMode = parseEnforceMode(process.env.ENFORCE_PASSWORD_CHANGE);
    const gate = evaluatePasswordGate({
      mustChangePassword: user.mustChangePassword,
      path: req.originalUrl,
      mode: pwMode,
    });
    if (gate.warn) {
      // No PII: role + method + path only (SA-023).
      console.warn(
        `[Auth] password-change would-block (warn-only) role=${user.role} ${req.method} ${req.originalUrl}`,
      );
    }
    if (gate.block) {
      return res.status(403).json({
        success: false,
        message: 'Please change your password before continuing',
        mustChangePassword: true,
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized - Invalid token',
    });
  }
});

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized to access this resource`,
      });
    }
    next();
  };
};

export const requirePasswordChange = (req, res, next) => {
  if (req.user.mustChangePassword) {
    return res.status(403).json({
      success: false,
      message: 'Please change your password before continuing',
      mustChangePassword: true,
    });
  }
  next();
};
