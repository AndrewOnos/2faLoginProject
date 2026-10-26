const logger = require('../utils/Logger');
const User = require('../models/userModel');
const jwt = require('jsonwebtoken');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user
    user = new User({
      username,
      email,
      password
    });

    await user.save();

    // Create token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(201).json({
      success: true,
      token
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
// In src/controllers/authController.js, update the login function:

exports.login = async (req, res) => {
    try {
      const { email, password } = req.body;
  
      // Check if user exists
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
  
      // Check if password matches
      const isMatch = await user.matchPassword(password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
  
      // If 2FA is enabled, return a temporary token and request 2FA code
      if (user.isTwoFactorEnabled) {
        return res.status(200).json({
          success: true,
          requireTwoFactor: true,
          userId: user._id
        });
      }
  
      // If 2FA is not enabled, create regular JWT token
      const token = jwt.sign(
        { id: user._id },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
  
      res.status(200).json({
        success: true,
        token
      });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ message: 'Server error' });
    }

    if (user.accountLocked && user.lockUntil > Date.now()) {
        return res.status(403).json({
          message: `Account is locked. Try again after ${new Date(user.lockUntil).toLocaleString()}`
        });
      }
      
      // Check if password matches
      const isMatch = await user.matchPassword(password);
      if (!isMatch) {
        // Increment failed login attempts
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
        
        // Lock account after 5 failed attempts
        if (user.failedLoginAttempts >= 5) {
          user.accountLocked = true;
          user.lockUntil = Date.now() + 15 * 60 * 1000; // Lock for 15 minutes
        }
        
        await user.save();
        
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      // Reset failed attempts on successful login
      user.failedLoginAttempts = 0;
      user.accountLocked = false;
      user.lockUntil = null;
      await user.save();





  };