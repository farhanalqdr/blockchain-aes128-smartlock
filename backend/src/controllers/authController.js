const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getBlockchainService } = require('../services/blockchainService');
const { getEncryptionService } = require('../services/encryptionService');
const logger = require('../utils/logger');

class AuthController {
  /**
   * Register a new user
   */
  static async register(req, res) {
    try {
      const { email, password, profile } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(409).json({
          error: 'User with this email already exists',
          code: 'USER_EXISTS'
        });
      }

      // Create new user (password hashing is handled by User model pre-save hook)
      // In demo mode, all users are admins
      const user = new User({
        email,
        password,
        role: 'admin', // All users are admins in demo mode
        profile,
        isActive: true
      });

      await user.save();

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: user._id,
          email: user.email,
          role: 'admin' // All users are admins in demo mode
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      logger.info(`New user registered: ${email}, Role: admin`);

      res.status(201).json({
        success: true,
        message: 'User registered successfully as admin',
        token,
        user: user.toProfileJSON()
      });

    } catch (error) {
      logger.error('User registration error:', error);
      res.status(500).json({
        error: 'Registration failed',
        code: 'REGISTRATION_ERROR',
        message: error.message
      });
    }
  }

  /**
   * User login
   */
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      // Find user by email
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(401).json({
          error: 'Account is deactivated',
          code: 'ACCOUNT_DEACTIVATED'
        });
      }

      // Verify password
      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        return res.status(401).json({
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: user._id,
          email: user.email,
          role: 'admin' // All users are admins in demo mode
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      // Update last login time
      user.lastLogin = new Date();
      await user.save();

      logger.info(`User logged in: ${email}`);

      res.json({
        success: true,
        message: 'Login successful',
        token,
        user: user.toProfileJSON()
      });

    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({
        error: 'Login failed',
        code: 'LOGIN_ERROR',
        message: error.message
      });
    }
  }

  /**
   * Get current user profile
   */
  static async getProfile(req, res) {
    try {
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        user: user.toProfileJSON()
      });

    } catch (error) {
      logger.error('Get profile error:', error);
      res.status(500).json({
        error: 'Failed to get profile',
        code: 'PROFILE_ERROR'
      });
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(req, res) {
    try {
      const { profile } = req.body;
      const userId = req.user.userId;

      // Find user
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Update user fields
      if (profile) {
        user.profile = { ...user.profile, ...profile };
      }

      await user.save();

      logger.info(`User profile updated: ${user.email}`);

      res.json({
        success: true,
        message: 'Profile updated successfully',
        user: user.toProfileJSON()
      });

    } catch (error) {
      logger.error('Update profile error:', error);
      res.status(500).json({
        error: 'Failed to update profile',
        code: 'PROFILE_UPDATE_ERROR',
        message: error.message
      });
    }
  }

  /**
   * Change password
   */
  static async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.userId;

      // Find user
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Verify current password
      const isValidPassword = await user.comparePassword(currentPassword);
      if (!isValidPassword) {
        return res.status(401).json({
          error: 'Current password is incorrect',
          code: 'INVALID_CURRENT_PASSWORD'
        });
      }

      // Update password (hashing is handled by pre-save hook)
      user.password = newPassword;
      await user.save();

      logger.info(`Password changed for user: ${user.email}`);

      res.json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      logger.error('Change password error:', error);
      res.status(500).json({
        error: 'Failed to change password',
        code: 'PASSWORD_CHANGE_ERROR',
        message: error.message
      });
    }
  }

  /**
   * Refresh JWT token
   */
  static async refreshToken(req, res) {
    try {
      const user = await User.findById(req.user.userId);
      if (!user || !user.isActive) {
        return res.status(401).json({
          error: 'Invalid token or user deactivated',
          code: 'INVALID_TOKEN'
        });
      }

      // Generate new JWT token
      const token = jwt.sign(
        {
          userId: user._id,
          email: user.email,
          role: 'admin' // All users are admins in demo mode
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      res.json({
        success: true,
        token,
        user: user.toProfileJSON()
      });

    } catch (error) {
      logger.error('Token refresh error:', error);
      res.status(500).json({
        error: 'Failed to refresh token',
        code: 'TOKEN_REFRESH_ERROR'
      });
    }
  }

  /**
   * Get public key for encryption
   */
  static async getPublicKey(req, res) {
    try {
      const encryptionService = getEncryptionService();
      const publicKey = encryptionService.getPublicKey();

      res.json({
        success: true,
        publicKey,
        keyInfo: encryptionService.getKeyInfo()
      });

    } catch (error) {
      logger.error('Get public key error:', error);
      res.status(500).json({
        error: 'Failed to get public key',
        code: 'PUBLIC_KEY_ERROR'
      });
    }
  }

  /**
   * Logout (client-side token invalidation)
   */
  static async logout(req, res) {
    try {
      // In a stateless JWT setup, logout is handled client-side
      // Here we can add token blacklisting if needed in the future
      
      logger.info(`User logged out: ${req.user.email}`);

      res.json({
        success: true,
        message: 'Logout successful'
      });

    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({
        error: 'Logout failed',
        code: 'LOGOUT_ERROR'
      });
    }
  }
}

module.exports = AuthController;