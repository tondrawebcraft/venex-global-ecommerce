import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { authCookie } from '../utils/security.js';
import { HttpError, asyncHandler } from '../utils/http.js';

export const protect = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.[authCookie] || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
  if (!token) throw new HttpError(401, 'Please sign in to continue.');
  let payload;
  try { payload = jwt.verify(token, process.env.JWT_SECRET); }
  catch { throw new HttpError(401, 'Your session has expired. Please sign in again.'); }
  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw new HttpError(401, 'This account is unavailable.');
  req.user = user;
  next();
});

export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.[authCookie];
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(payload.sub) || undefined;
    } catch { req.user = undefined; }
  }
  next();
});

export function adminOnly(req, _res, next) {
  if (req.user?.role !== 'admin') return next(new HttpError(403, 'Admin access is required.'));
  next();
}

