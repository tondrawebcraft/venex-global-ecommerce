import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import authRoutes from './routes/authRoutes.js';
import catalogRoutes from './routes/catalogRoutes.js';
import commerceRoutes from './routes/commerceRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { csrfProtection } from './middleware/csrf.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { ok } from './utils/http.js';

const app = express();
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((entry) => entry.trim());

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false }));
app.use(cors({ origin(origin, callback) { if (!origin || allowedOrigins.includes(origin)) return callback(null, true); callback(new Error('Origin is not allowed by CORS.')); }, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use((req, _res, next) => {
  function clean(value) {
    if (Array.isArray(value)) return value.forEach(clean);
    if (!value || typeof value !== 'object') return;
    for (const key of Object.keys(value)) {
      if (key.startsWith('$') || key.includes('.')) delete value[key];
      else clean(value[key]);
    }
  }
  clean(req.body);
  next();
});
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use('/uploads', express.static(path.resolve('uploads'), { maxAge: '7d', immutable: true }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api', csrfProtection);
app.get('/api/health', (_req, res) => ok(res, { service: 'venex-global-api', status: 'healthy', timestamp: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api', catalogRoutes);
app.use('/api', commerceRoutes);
app.use('/api/admin', adminRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;

