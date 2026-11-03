export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

export function ok(res, data, meta) {
  return res.json({ success: true, data, ...(meta ? { meta } : {}) });
}

