import { csrfCookie } from '../utils/security.js';
import { HttpError } from '../utils/http.js';

export function csrfProtection(req, _res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  if (!req.cookies?.venex_token) return next();
  const cookie = req.cookies[csrfCookie];
  const header = req.get('x-csrf-token');
  if (!cookie || !header || cookie !== header) return next(new HttpError(403, 'Request verification failed. Refresh the page and try again.'));
  next();
}

