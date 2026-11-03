import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

export const authCookie = 'venex_token';
export const csrfCookie = 'venex_csrf';

export function tokenOptions() {
  const production = process.env.NODE_ENV === 'production';
  return { httpOnly: true, secure: production, sameSite: 'strict', path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 };
}

export function issueSession(res, user) {
  const token = jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
  res.cookie(authCookie, token, tokenOptions());
  res.cookie(csrfCookie, crypto.randomBytes(24).toString('hex'), { ...tokenOptions(), httpOnly: false });
}

export function clearSession(res) {
  res.clearCookie(authCookie, { ...tokenOptions(), maxAge: undefined });
  res.clearCookie(csrfCookie, { ...tokenOptions(), httpOnly: false, maxAge: undefined });
}

export function randomToken() {
  return crypto.randomBytes(32).toString('hex');
}

