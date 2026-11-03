import crypto from 'node:crypto';
import { validationResult } from 'express-validator';
import User from '../models/User.js';
import { asyncHandler, HttpError, ok } from '../utils/http.js';
import { clearSession, issueSession, randomToken } from '../utils/security.js';
import Cart from '../models/Cart.js';
import Wishlist from '../models/Wishlist.js';
import { sendPasswordReset } from '../services/email.js';

function validate(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new HttpError(400, 'Please check the information and try again.', errors.array().map(({ path, msg }) => ({ field: path, message: msg })));
}

function publicUser(user) { return { id: user._id, name: user.name, email: user.email, phone: user.phone || '', role: user.role }; }

async function mergeGuestData(req, user) {
  const sessionId = req.get('x-session-id');
  if (!sessionId || !/^[a-zA-Z0-9-]{16,80}$/.test(sessionId)) return;
  const [guestCart, userCart, guestWishlist, userWishlist] = await Promise.all([
    Cart.findOne({ sessionId }), Cart.findOne({ user: user._id }),
    Wishlist.findOne({ sessionId }), Wishlist.findOne({ user: user._id })
  ]);
  if (guestCart) {
    const target = userCart || new Cart({ user: user._id, items: [] });
    for (const guestLine of guestCart.items) {
      const existing = target.items.find((line) => line.product.toString() === guestLine.product.toString() && line.size === guestLine.size && line.color === guestLine.color);
      if (existing) existing.quantity = Math.min(50, existing.quantity + guestLine.quantity);
      else target.items.push(guestLine.toObject());
    }
    if (!target.couponCode) target.couponCode = guestCart.couponCode;
    await target.save();
    await guestCart.deleteOne();
  }
  if (guestWishlist) {
    const target = userWishlist || new Wishlist({ user: user._id, products: [] });
    for (const id of guestWishlist.products) if (!target.products.some((current) => current.toString() === id.toString())) target.products.push(id);
    await target.save();
    await guestWishlist.deleteOne();
  }
}

export const register = asyncHandler(async (req, res) => {
  validate(req);
  const { name, email, password, phone } = req.body;
  const user = await User.create({ name, email, password, phone, role: 'customer' });
  await mergeGuestData(req, user);
  issueSession(res, user);
  ok(res, { user: publicUser(user) });
});

export const login = asyncHandler(async (req, res) => {
  validate(req);
  const user = await User.findOne({ email: req.body.email.toLowerCase() }).select('+password');
  if (!user || !await user.comparePassword(req.body.password)) throw new HttpError(401, 'Email or password is incorrect.');
  if (!user.isActive) throw new HttpError(403, 'This account is unavailable.');
  await mergeGuestData(req, user);
  issueSession(res, user);
  ok(res, { user: publicUser(user) });
});

export const logout = asyncHandler(async (_req, res) => { clearSession(res); ok(res, { message: 'Signed out.' }); });
export const me = asyncHandler(async (req, res) => ok(res, { user: publicUser(req.user) }));

export const updateProfile = asyncHandler(async (req, res) => {
  validate(req);
  const fields = {};
  for (const key of ['name', 'phone']) if (req.body[key] !== undefined) fields[key] = req.body[key];
  const user = await User.findByIdAndUpdate(req.user._id, fields, { new: true, runValidators: true });
  ok(res, { user: publicUser(user) });
});

export const changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!await user.comparePassword(req.body.currentPassword || '')) throw new HttpError(400, 'Current password is incorrect.');
  if (typeof req.body.password !== 'string' || req.body.password.length < 8) throw new HttpError(400, 'New password must be at least 8 characters.');
  user.password = req.body.password;
  await user.save();
  issueSession(res, user);
  ok(res, { message: 'Password updated.' });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.');
  const user = await User.findOne({ email });
  if (user) {
    const raw = randomToken();
    user.resetTokenHash = crypto.createHash('sha256').update(raw).digest('hex');
    user.resetTokenExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await user.save({ validateBeforeSave: false });
    const base = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].replace(/\/$/, '');
    try { await sendPasswordReset(user, `${base}/reset-password?token=${encodeURIComponent(raw)}`); }
    catch (error) { if (process.env.NODE_ENV !== 'production') console.error('Password reset email delivery failed.', error); }
    if (process.env.NODE_ENV !== 'production' && process.env.DEV_RESET_LINKS === 'true') res.locals.devResetToken = raw;
  }
  ok(res, { message: 'If that account exists, password reset instructions will be sent.', ...(res.locals.devResetToken ? { developmentResetToken: res.locals.devResetToken } : {}) });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const raw = String(req.body.token || '');
  if (!raw || typeof req.body.password !== 'string' || req.body.password.length < 8) throw new HttpError(400, 'A valid reset token and password of at least 8 characters are required.');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const user = await User.findOne({ resetTokenHash: hash, resetTokenExpiresAt: { $gt: new Date() } }).select('+password');
  if (!user) throw new HttpError(400, 'This reset link has expired or is invalid.');
  user.password = req.body.password;
  user.resetTokenHash = undefined;
  user.resetTokenExpiresAt = undefined;
  await user.save();
  issueSession(res, user);
  ok(res, { user: publicUser(user) });
});

