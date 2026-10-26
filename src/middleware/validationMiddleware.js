const logger = require('../utils/Logger');
const { validationResult, check } = require('express-validator');

// Validation result middleware
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Registration validation rules
exports.registerValidation = [
  check('username', 'Username is required').notEmpty().trim(),
  check('email', 'Please include a valid email').isEmail().normalizeEmail(),
  check('password', 'Password must be at least 6 characters').isLength({ min: 6 })
];

// Login validation rules
exports.loginValidation = [
  check('email', 'Please include a valid email').isEmail().normalizeEmail(),
  check('password', 'Password is required').exists()
];

// TOTP validation rules
exports.totpValidation = [
  check('token', 'Verification code must be 6 digits').isLength({ min: 6, max: 6 }).isNumeric()
];