
const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');
const { authLimiter } = require('../utils/rateLimiter');

const { 
    registerValidation, 
    loginValidation, 
    validate 
  } = require('../middleware/validationMiddleware');


// Routes
router.post('/register', register);
router.post('/login', authLimiter, login);
router.post('/register', registerValidation, validate, register);
router.post('/login', loginValidation, validate, login);


module.exports = router;