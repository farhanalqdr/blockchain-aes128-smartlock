const express = require('express');
const AuthController = require('../controllers/authController');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register',
  authLimiter,
  AuthController.register
);

/**
 * @route   POST /api/auth/login
 * @desc    User login
 * @access  Public
 */
router.post('/login',
  authLimiter,
  AuthController.login
);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile',
  authenticateToken,
  AuthController.getProfile
);

/**
 * @route   GET /api/auth/public-key
 * @desc    Get public key for encryption
 * @access  Public
 */
router.get('/public-key',
  optionalAuth, // Optional auth for logging purposes
  AuthController.getPublicKey
);

/**
 * @route   POST /api/auth/logout
 * @desc    User logout (client-side token invalidation)
 * @access  Private
 */
router.post('/logout',
  authenticateToken,
  AuthController.logout
);

module.exports = router;