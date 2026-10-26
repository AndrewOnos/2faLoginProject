
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  // 2FA fields
  isTwoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    default: null
  },
  recoveryCodes: {
    type: [String],
    default: []
  },
  
  // Security tracking fields
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  accountLocked: {
    type: Boolean,
    default: false
  },
  lockUntil: {
    type: Date,
    default: null
  },
  
  // 2FA attempt tracking
  failedTwoFactorAttempts: {
    type: Number,
    default: 0
  },
  twoFactorLocked: {
    type: Boolean,
    default: false
  },
  twoFactorLockUntil: {
    type: Date,
    default: null
  },
  
  // Recovery attempt tracking
  failedRecoveryAttempts: {
    type: Number,
    default: 0
  },
  recoveryLocked: {
    type: Boolean,
    default: false
  },
  recoveryLockUntil: {
    type: Date,
    default: null
  }

});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;