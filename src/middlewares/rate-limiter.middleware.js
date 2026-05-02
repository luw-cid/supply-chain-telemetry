const AppError = require('../utils/app-error');

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

const store = new Map();

function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  let entry = store.get(ip);

  if (!entry || now - entry.reset > WINDOW_MS) {
    entry = { count: 1, reset: now };
    store.set(ip, entry);
    return next();
  }

  entry.count++;
  if (entry.count > MAX_REQUESTS) {
    return next(AppError.tooManyRequests('Too many requests. Try again later.'));
  }

  return next();
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of store) {
    if (now - entry.reset > WINDOW_MS) store.delete(ip);
  }
}, 60_000).unref();

module.exports = rateLimiter;
