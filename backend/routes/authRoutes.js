import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, logout, me, updateProfile, changePassword, forgotPassword, resetPassword } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { ok } from '../utils/http.js';
import crypto from 'node:crypto';
import { csrfCookie, tokenOptions } from '../utils/security.js';

const router = Router();
const password = body('password').isLength({ min: 8 }).withMessage('Use at least 8 characters.');
router.get('/csrf', (req, res) => {
  let token = req.cookies?.[csrfCookie];
  if (!token) { token = crypto.randomBytes(24).toString('hex'); res.cookie(csrfCookie, token, { ...tokenOptions(), httpOnly: false }); }
  ok(res, { token });
});
router.post('/register', body('name').trim().isLength({ min: 2, max: 100 }), body('email').isEmail().normalizeEmail(), password, register);
router.post('/login', body('email').isEmail().normalizeEmail(), body('password').isString().notEmpty(), login);
router.post('/logout', logout);
router.get('/me', protect, me);
router.patch('/profile', protect, body('name').optional().trim().isLength({ min: 2, max: 100 }), body('phone').optional().trim().isLength({ max: 30 }), updateProfile);
router.patch('/password', protect, password, changePassword);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
export default router;

