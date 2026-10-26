const logger = require('../utils/Logger');
// Not Found Error Handler
exports.notFound = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error);
  };
  
  // Error Handler
  exports.errorHandler = (err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    
    // Log error
    logger.error(`Error: ${err.message}`);
    if (process.env.NODE_ENV === 'development') {
      logger.error(err.stack);
    }
    
    res.status(statusCode).json({
      message: err.message,
      stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack
    });
  };