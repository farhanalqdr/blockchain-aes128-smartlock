const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * Create a rate limiter with custom configuration
 */
const createRateLimiter = (options = {}) => {
  const {
    windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message = 'Too many requests from this IP, please try again later.',
    standardHeaders = true,
    legacyHeaders = false,
    handler = (req, res) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
      res.status(429).json({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        message: message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  } = options;

  return rateLimit({
    windowMs,
    max,
    message,
    standardHeaders,
    legacyHeaders,
    handler,
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise use IP
      return req.user ? `user:${req.user.userId}` : req.ip;
    },
    skip: (req) => {
      // Skip rate limiting for health checks and static assets
      return req.path === '/health' || req.path.startsWith('/static');
    }
  });
};

/**
 * General API rate limiter
 */
const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP/user to 100 requests per windowMs
  message: 'Too many API requests, please try again later.'
});

/**
 * Strict rate limiter for authentication endpoints
 */
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  handler: (req, res) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip}, Email: ${req.body.email}`);
    res.status(429).json({
      error: 'Authentication rate limit exceeded',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later.',
      retryAfter: Math.ceil(15 * 60) // 15 minutes
    });
  }
});

/**
 * Rate limiter for device data submission
 */
const dataSubmissionLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each device to 30 data submissions per minute
  message: 'Too many data submissions, please wait before submitting again.',
  keyGenerator: (req) => {
    // Use device address for device-specific rate limiting
    return req.device ? `device:${req.device.deviceAddress}` : req.ip;
  }
});

/**
 * Rate limiter for device registration
 */
const deviceRegistrationLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each user to 10 device registrations per hour
  message: 'Too many device registrations, please try again later.',
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise use IP
    return req.user ? `user:${req.user.userId}` : req.ip;
  }
});

/**
 * Rate limiter for blockchain operations
 */
const blockchainLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // Limit each user to 20 blockchain operations per 5 minutes
  message: 'Too many blockchain operations, please try again later.'
});

/**
 * Create a custom rate limiter for specific use cases
 */
const customLimiter = (options) => createRateLimiter(options);

/**
 * Middleware to add rate limit headers to responses
 */
const addRateLimitHeaders = (req, res, next) => {
  res.setHeader('X-RateLimit-Limit', '100');
  res.setHeader('X-RateLimit-Window', '15m');
  next();
};

/**
 * Middleware to check if user has premium rate limits
 */
const premiumRateLimit = (req, res, next) => {
  // This would typically check if user has premium subscription
  // For now, we'll just apply standard limits
  return apiLimiter(req, res, next);
};

/**
 * Rate limiter for WebSocket connections
 */
const websocketLimiter = new Map();

const checkWebsocketRateLimit = (ws, req) => {
  const clientId = req.user ? `user:${req.user.userId}` : req.ip;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxConnections = 10;

  if (!websocketLimiter.has(clientId)) {
    websocketLimiter.set(clientId, {
      connections: 0,
      lastReset: now
    });
  }

  const clientData = websocketLimiter.get(clientId);

  // Reset counter if window has passed
  if (now - clientData.lastReset > windowMs) {
    clientData.connections = 0;
    clientData.lastReset = now;
  }

  if (clientData.connections >= maxConnections) {
    return false;
  }

  clientData.connections++;
  return true;
};

/**
 * Clean up expired WebSocket rate limit entries
 */
const cleanupWebsocketLimiter = () => {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute

  for (const [clientId, data] of websocketLimiter.entries()) {
    if (now - data.lastReset > windowMs) {
      websocketLimiter.delete(clientId);
    }
  }
};

// Clean up WebSocket rate limiter every 5 minutes
setInterval(cleanupWebsocketLimiter, 5 * 60 * 1000);

/**
 * Rate limiter for file uploads
 */
const uploadLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each user to 50 uploads per hour
  message: 'Too many file uploads, please try again later.'
});

/**
 * Rate limiter for API key generation
 */
const apiKeyLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5, // Limit each user to 5 API keys per day
  message: 'Too many API key generation attempts, please try again tomorrow.'
});

module.exports = {
  apiLimiter,
  authLimiter,
  dataSubmissionLimiter,
  deviceRegistrationLimiter,
  blockchainLimiter,
  customLimiter,
  addRateLimitHeaders,
  premiumRateLimit,
  checkWebsocketRateLimit,
  uploadLimiter,
  apiKeyLimiter,
  createRateLimiter
};