
const winston = require('winston');
const path = require('path');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.printf(info => {
    return `${info.timestamp} [${info.level}]: ${info.message}`;
  })
);

// Create logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  transports: [
    // Console logging
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),
    // File logging - general logs
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/app.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // File logging - error logs
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // File logging - security logs
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/security.log'),
      level: 'warn',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

module.exports = logger;