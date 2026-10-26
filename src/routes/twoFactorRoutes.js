
const express = require('express');
const router = express.Router();
const { 
  generate2FASecret, 
  verify2FA, 
  validate2FAToken, 
  disable2FA,
  recoverWith2FACode,
  generateNewRecoveryCodes,
  get2FAStatus
} = require('../controllers/twoFactorController');
const { protect } = require('../middleware/authMiddleware');
const { twoFactorLimiter } = require('../utils/rateLimiter');
const { totpValidation, validate } = require('../middleware/validationMiddleware');

// Protected routes (require authentication)
router.post('/generate', protect, generate2FASecret);
router.post('/verify', protect, totpValidation, validate, verify2FA);
router.post('/disable', protect, disable2FA);
router.post('/generate-recovery-codes', protect, generateNewRecoveryCodes);
router.get('/status', protect, get2FAStatus);

// Public routes
router.post('/validate', twoFactorLimiter, totpValidation, validate, validate2FAToken);
router.post('/recover', twoFactorLimiter, recoverWith2FACode);

module.exports = router;