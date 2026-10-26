
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const { encrypt, decrypt } = require('../utils/encryption');
const { generateRecoveryCodes, verifyRecoveryCode } = require('../utils/recoveryCode');
const logger = require('../utils/logger');

// @desc    Generate 2FA secret for a user
// @route   POST /api/2fa/generate
// @access  Private
exports.generate2FASecret = async (req, res) => {
  try {
    // Find user
    const user = await User.findById(req.user.id);
    if (!user) {
      logger.warn(`2FA secret generation failed: User not found - ID: ${req.user.id}`);
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate a new secret
    const secret = speakeasy.generateSecret({
      length: 20,
      name: `2FA-Auth-System:${user.email}`
    });

    // Encrypt the secret before saving
    user.twoFactorSecret = encrypt(secret.base32);
    await user.save();

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    logger.info(`2FA secret generated for user: ${user.email}`);
    res.status(200).json({
      success: true,
      secret: secret.base32,
      qrCodeUrl
    });
  } catch (error) {
    logger.error(`Error generating 2FA secret: ${error.message}`, error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Verify and enable 2FA for a user
// @route   POST /api/2fa/verify
// @access  Private
exports.verify2FA = async (req, res) => {
  try {
    const { token } = req.body;
    
    // Find user
    const user = await User.findById(req.user.id);
    if (!user) {
      logger.warn(`2FA verification failed: User not found - ID: ${req.user.id}`);
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify the token against the secret
    const verified = speakeasy.totp.verify({
      secret: decrypt(user.twoFactorSecret),
      encoding: 'base32',
      token,
      window: 1 // Allow 1 time step before/after for clock skew
    });

    if (!verified) {
      logger.warn(`2FA verification failed: Invalid token for user ${user.email}`);
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    // Generate recovery codes
    const recoveryCodes = await generateRecoveryCodes();
    const plaintextCodes = recoveryCodes.map(code => code.plaintext);
    const hashedCodes = recoveryCodes.map(code => code.hashed);

    // Enable 2FA for the user and save recovery codes
    user.isTwoFactorEnabled = true;
    user.recoveryCodes = hashedCodes;
    await user.save();

    logger.info(`2FA enabled for user: ${user.email}`);
    res.status(200).json({
      success: true,
      message: 'Two-factor authentication enabled successfully',
      recoveryCodes: plaintextCodes
    });
  } catch (error) {
    logger.error(`Error verifying 2FA: ${error.message}`, error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Validate 2FA token during login
// @route   POST /api/2fa/validate
// @access  Public
exports.validate2FAToken = async (req, res) => {
  try {
    const { userId, token } = req.body;
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      logger.warn(`2FA validation failed: User not found - ID: ${userId}`);
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if 2FA is enabled
    if (!user.isTwoFactorEnabled) {
      logger.warn(`2FA validation failed: 2FA not enabled for user ${user.email}`);
      return res.status(400).json({ message: 'Two-factor authentication is not enabled for this account' });
    }

    // Verify the token against the secret
    const verified = speakeasy.totp.verify({
      secret: decrypt(user.twoFactorSecret),
      encoding: 'base32',
      token,
      window: 1 // Allow 1 time step before/after for clock skew
    });

    if (!verified) {
      // Track failed 2FA attempts
      user.failedTwoFactorAttempts = (user.failedTwoFactorAttempts || 0) + 1;
      
      // Lock 2FA after 3 failed attempts
      if (user.failedTwoFactorAttempts >= 3) {
        user.twoFactorLocked = true;
        user.twoFactorLockUntil = Date.now() + 15 * 60 * 1000; // Lock for 15 minutes
      }
      
      await user.save();
      
      logger.warn(`2FA validation failed: Invalid token for user ${user.email}, attempt ${user.failedTwoFactorAttempts}`);
      return res.status(400).json({ 
        message: 'Invalid verification code',
        attemptsRemaining: Math.max(0, 3 - user.failedTwoFactorAttempts)
      });
    }

    // Reset failed attempts on successful verification
    user.failedTwoFactorAttempts = 0;
    user.twoFactorLocked = false;
    user.twoFactorLockUntil = null;
    await user.save();

    // Create JWT token
    const jwtToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    logger.info(`2FA validation successful for user: ${user.email}`);
    res.status(200).json({
      success: true,
      token: jwtToken
    });
  } catch (error) {
    logger.error(`Error validating 2FA token: ${error.message}`, error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Disable 2FA for a user
// @route   POST /api/2fa/disable
// @access  Private
exports.disable2FA = async (req, res) => {
  try {
    // Find user
    const user = await User.findById(req.user.id);
    if (!user) {
      logger.warn(`2FA disable failed: User not found - ID: ${req.user.id}`);
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if 2FA is enabled
    if (!user.isTwoFactorEnabled) {
      return res.status(400).json({ message: 'Two-factor authentication is not enabled for this account' });
    }

    // Disable 2FA
    user.isTwoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.recoveryCodes = [];
    await user.save();

    logger.info(`2FA disabled for user: ${user.email}`);
    res.status(200).json({
      success: true,
      message: 'Two-factor authentication disabled successfully'
    });
  } catch (error) {
    logger.error(`Error disabling 2FA: ${error.message}`, error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Recover account using a recovery code
// @route   POST /api/2fa/recover
// @access  Public
exports.recoverWith2FACode = async (req, res) => {
  try {
    const { userId, recoveryCode } = req.body;
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      logger.warn(`2FA recovery failed: User not found - ID: ${userId}`);
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify if user has 2FA enabled
    if (!user.isTwoFactorEnabled) {
      return res.status(400).json({ message: 'Two-factor authentication is not enabled for this account' });
    }

    // Check if recovery is locked
    if (user.recoveryLocked && user.recoveryLockUntil > Date.now()) {
      logger.warn(`2FA recovery locked for user: ${user.email}`);
      return res.status(403).json({
        message: `Account recovery is locked due to too many attempts. Try again after ${new Date(user.recoveryLockUntil).toLocaleString()}`
      });
    }

    // Verify recovery code
    const codeIndex = await verifyRecoveryCode(recoveryCode, user.recoveryCodes);
    if (codeIndex === -1) {
      // Track failed recovery attempts
      user.failedRecoveryAttempts = (user.failedRecoveryAttempts || 0) + 1;
      
      // Lock recovery after 3 failed attempts
      if (user.failedRecoveryAttempts >= 3) {
        user.recoveryLocked = true;
        user.recoveryLockUntil = Date.now() + 30 * 60 * 1000; // Lock for 30 minutes
      }
      
      await user.save();
      
      logger.warn(`2FA recovery failed: Invalid code for user ${user.email}, attempt ${user.failedRecoveryAttempts}`);
      return res.status(400).json({ 
        message: 'Invalid recovery code',
        attemptsRemaining: Math.max(0, 3 - user.failedRecoveryAttempts)
      });
    }

    // Remove the used recovery code
    user.recoveryCodes.splice(codeIndex, 1);
    
    // Reset failed attempts
    user.failedRecoveryAttempts = 0;
    user.recoveryLocked = false;
    user.recoveryLockUntil = null;
    await user.save();

    // Create JWT token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    logger.info(`2FA recovery successful for user: ${user.email}`);
    res.status(200).json({
      success: true,
      token,
      message: 'Recovery successful. Please generate new recovery codes as this one has been used.',
      recoveryCodesRemaining: user.recoveryCodes.length
    });
  } catch (error) {
    logger.error(`Error in 2FA recovery: ${error.message}`, error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Generate new recovery codes
// @route   POST /api/2fa/generate-recovery-codes
// @access  Private
exports.generateNewRecoveryCodes = async (req, res) => {
  try {
    // Find user
    const user = await User.findById(req.user.id);
    if (!user) {
      logger.warn(`Recovery codes generation failed: User not found - ID: ${req.user.id}`);
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if 2FA is enabled
    if (!user.isTwoFactorEnabled) {
      return res.status(400).json({ message: 'Two-factor authentication is not enabled for this account' });
    }

    // Generate new recovery codes
    const recoveryCodes = await generateRecoveryCodes();
    const plaintextCodes = recoveryCodes.map(code => code.plaintext);
    const hashedCodes = recoveryCodes.map(code => code.hashed);

    // Save new recovery codes
    user.recoveryCodes = hashedCodes;
    await user.save();

    logger.info(`New recovery codes generated for user: ${user.email}`);
    res.status(200).json({
      success: true,
      message: 'New recovery codes generated successfully',
      recoveryCodes: plaintextCodes
    });
  } catch (error) {
    logger.error(`Error generating recovery codes: ${error.message}`, error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get 2FA status for a user
// @route   GET /api/2fa/status
// @access  Private
exports.get2FAStatus = async (req, res) => {
  try {
    // Find user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      isTwoFactorEnabled: user.isTwoFactorEnabled,
      recoveryCodesCount: user.recoveryCodes ? user.recoveryCodes.length : 0
    });
  } catch (error) {
    logger.error(`Error getting 2FA status: ${error.message}`, error);
    res.status(500).json({ message: 'Server error' });
  }
};