import mongoose from 'mongoose';

export function notFound(req, _res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.status = 404;
  next(error);
}

export function errorHandler(error, _req, res, _next) {
  let status = error.status || 500;
  let message = error.message || 'Something went wrong.';
  if (error instanceof mongoose.Error.ValidationError) { status = 400; message = Object.values(error.errors).map((entry) => entry.message).join(', '); }
  if (error.code === 11000) { status = 409; message = 'That value is already in use.'; }
  if (error.name === 'CastError') { status = 400; message = 'Invalid resource identifier.'; }
  if (process.env.NODE_ENV !== 'production') console.error(error);
  res.status(status).json({ success: false, error: { message, ...(error.details ? { details: error.details } : {}) } });
}

