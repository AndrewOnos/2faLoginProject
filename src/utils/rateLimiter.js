
const rateLimit = require('express-rate-limit');

// Authentication rate limiter
exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts, please try again after 15 minutes' },
  skipSuccessfulRequests: true // Only count failed attempts
});

// 2FA attempts rate limiter (more strict)
exports.twoFactorLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // 3 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many verification attempts, please try again after 15 minutes' },
  skipSuccessfulRequests: true
});

// General API rate limiter
exports.apiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later' }
});