const rateLimit = require('express-rate-limit');

// Basic IP-based limiter for all bot routes
const botsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,                 // 100 requests per IP per hour
  message: {
    success: false,
    message: 'Too many requests. Please wait before running more bots.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  botsLimiter,
};
