
const logger = require('../utils/Logger');

exports.auditLog = (req, res, next) => {
  // Log all authentication attempts
  if (req.path.includes('/api/auth/login') || req.path.includes('/api/2fa/validate')) {
    logger.warn(`Authentication attempt: ${req.method} ${req.path} from IP: ${req.ip}`);
  }
  
  // Log all 2FA operations
  if (req.path.includes('/api/2fa/')) {
    logger.warn(`2FA operation: ${req.method} ${req.path} from IP: ${req.ip}`);
  }
  
  next();
};