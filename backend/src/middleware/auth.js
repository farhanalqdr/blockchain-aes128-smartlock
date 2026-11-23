const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * JWT Authentication Middleware
 * Verifies JWT token and attaches user information to request object
 * All authenticated users are treated as admins in this demo
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Access token required',
        code: 'TOKEN_MISSING'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user in database
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({
        error: 'Invalid token - user not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        error: 'Account is deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    // Attach user information to request
    // All authenticated users are admins in this demo
    req.user = {
      userId: user._id,
      email: user.email,
      role: 'admin', // All users are admins in demo mode
      walletAddress: user.walletAddress
    };

    // Update last login time
    user.lastLogin = new Date();
    await user.save();

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        code: 'TOKEN_INVALID'
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    } else {
      logger.error('Authentication middleware error:', error);
      return res.status(500).json({
        error: 'Authentication error',
        code: 'AUTH_ERROR'
      });
    }
  }
};

/**
 * Role-based Authorization Middleware (Simplified)
 * In demo mode, all authenticated users are admins, so this just checks authentication
 */
const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // In demo mode, all authenticated users are admins, so we always allow access
    // This middleware is kept for backward compatibility but doesn't restrict access
    next();
  };
};

/**
 * Device Authentication Middleware
 * Authenticates requests from IoT devices using device wallet address
 */
const authenticateDevice = async (req, res, next) => {
  try {
    const deviceAddress = req.headers['x-device-address'];
    const deviceSignature = req.headers['x-device-signature'];
    const timestamp = req.headers['x-timestamp'];

    if (!deviceAddress || !deviceSignature || !timestamp) {
      return res.status(401).json({ 
        error: 'Device authentication headers required',
        code: 'DEVICE_HEADERS_MISSING'
      });
    }

    // Check if timestamp is within acceptable range (5 minutes)
    const currentTime = Date.now();
    const requestTime = parseInt(timestamp);
    const timeDiff = Math.abs(currentTime - requestTime);
    
    if (timeDiff > 5 * 60 * 1000) { // 5 minutes
      return res.status(401).json({ 
        error: 'Request timestamp expired',
        code: 'TIMESTAMP_EXPIRED'
      });
    }

    // Find device in database
    const Device = require('../models/Device');
    const device = await Device.findOne({ 
      walletAddress: deviceAddress,
      isApproved: true 
    });

    if (!device) {
      return res.status(401).json({ 
        error: 'Device not found or not approved',
        code: 'DEVICE_NOT_APPROVED'
      });
    }

    // Verify device signature (this would depend on your device authentication scheme)
    // For now, we'll just check if the device exists and is approved
    // In a real implementation, you would verify the cryptographic signature

    // Attach device information to request
    req.device = {
      deviceId: device._id,
      deviceAddress: device.walletAddress,
      macAddress: device.macAddress,
      ownerId: device.owner // May be null for devices created from blockchain events
    };

    next();
  } catch (error) {
    logger.error('Device authentication middleware error:', error);
    return res.status(500).json({ 
      error: 'Device authentication error',
      code: 'DEVICE_AUTH_ERROR'
    });
  }
};

/**
 * Optional Authentication Middleware
 * Attaches user information if token is present, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (user && user.isActive) {
        req.user = {
          userId: user._id,
          email: user.email,
          role: user.role,
          walletAddress: user.walletAddress
        };
      }
    }

    next();
  } catch (error) {
    // For optional auth, we just continue without attaching user info
    next();
  }
};

/**
 * Resource Ownership Middleware (Simplified)
 * In demo mode, all authenticated users are admins, so ownership checks are bypassed
 * This middleware is kept for backward compatibility but doesn't restrict access
 */
const checkOwnership = (resourceModel, resourceIdParam = 'id', ownerField = 'owner') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[resourceIdParam];

      if (!resourceId) {
        return res.status(400).json({
          error: 'Resource ID required',
          code: 'RESOURCE_ID_MISSING'
        });
      }

      const Resource = require(`../models/${resourceModel}`);
      const resource = await Resource.findById(resourceId);

      if (!resource) {
        return res.status(404).json({
          error: 'Resource not found',
          code: 'RESOURCE_NOT_FOUND'
        });
      }

      // In demo mode, all authenticated users are admins, so we always allow access
      // Attach resource to request for use in next middleware/controller
      req.resource = resource;
      next();
    } catch (error) {
      logger.error('Ownership check middleware error:', error);
      return res.status(500).json({
        error: 'Ownership check error',
        code: 'OWNERSHIP_CHECK_ERROR'
      });
    }
  };
};

module.exports = {
  authenticateToken,
  authorizeRole,
  authenticateDevice,
  optionalAuth,
  checkOwnership
};