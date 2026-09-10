const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// Standard JSON response instead of the default plain-text one
const jsonHandler = (req, res, next, options) => {
  res.status(options.statusCode).json({ message: options.message });
};

// ---- Fixed-window limiters (express-rate-limit built-in) ----
// Good enough for auth/uploads/general traffic — low stakes if edge-burst is exploited.

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login/register attempts. Please try again in 15 minutes.',
  handler: jsonHandler,
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip),
  message: 'Too many uploads. Please slow down and try again shortly.',
  handler: jsonHandler,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip),
  message: 'Too many requests. Please slow down.',
  handler: jsonHandler,
});

// ---- Hand-rolled sliding-window-counter limiter (for Gemini generation routes) ----
// Money is on the line per request, so we close the fixed-window edge-burst gap here.
// Approximates sliding window log using two counters (O(1) memory/compute per key)
// instead of storing every request timestamp.

const generationWindowMs = 60 * 60 * 1000; // 1 hour
const generationMax = 20; // 20 AI generations per rolling hour

// key -> { currentCount, currentWindowStart, previousCount }
const generationStore = new Map();

const generationLimiter = (req, res, next) => {
  const key = req.user?.id || req.ip;
  const now = Date.now();

  let entry = generationStore.get(key);
  if (!entry) {
    entry = { currentCount: 0, currentWindowStart: now, previousCount: 0 };
    generationStore.set(key, entry);
  }

  const elapsed = now - entry.currentWindowStart;

  if (elapsed >= generationWindowMs) {
    // Roll windows forward. If more than one full window has passed,
    // there's no relevant "previous" traffic left.
    const windowsPassed = Math.floor(elapsed / generationWindowMs);
    entry.previousCount = windowsPassed === 1 ? entry.currentCount : 0;
    entry.currentCount = 0;
    entry.currentWindowStart += windowsPassed * generationWindowMs;
  }

  const currentElapsed = now - entry.currentWindowStart;
  const weight = 1 - currentElapsed / generationWindowMs; // how much of "previous" still counts
  const estimatedCount = entry.previousCount * weight + entry.currentCount;

  if (estimatedCount >= generationMax) {
    res.setHeader('RateLimit-Limit', generationMax);
    res.setHeader('RateLimit-Remaining', 0);
    return res.status(429).json({
      message: 'You have reached the hourly limit for AI-generated content. Please try again later.',
    });
  }

  entry.currentCount += 1;
  res.setHeader('RateLimit-Limit', generationMax);
  res.setHeader('RateLimit-Remaining', Math.max(0, Math.floor(generationMax - estimatedCount - 1)));
  next();
};

module.exports = { authLimiter, generationLimiter, uploadLimiter, apiLimiter };