const Joi = require('joi');
const logger = require('../utils/logger');

/**
 * Validation middleware factory
 * Creates middleware that validates request body against a Joi schema
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false, // Include all errors
      allowUnknown: false, // Don't allow unknown fields
      stripUnknown: true // Remove unknown fields
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context.value
      }));

      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errorDetails
      });
    }

    // Replace the property with validated and cleaned data
    req[property] = value;
    next();
  };
};

// User validation schemas
const userSchemas = {
  register: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    password: Joi.string().min(6).required().messages({
      'string.min': 'Password must be at least 6 characters long',
      'any.required': 'Password is required'
    }),
    // Role is auto-set to 'admin' in demo mode, no need for validation
    profile: Joi.object({
      firstName: Joi.string().trim().max(50),
      lastName: Joi.string().trim().max(50),
      company: Joi.string().trim().max(100)
    }).optional(),
    walletAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).optional().messages({
      'string.pattern.base': 'Please provide a valid Ethereum address'
    })
  }),

  login: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    password: Joi.string().required().messages({
      'any.required': 'Password is required'
    })
  }),

  updateProfile: Joi.object({
    profile: Joi.object({
      firstName: Joi.string().trim().max(50),
      lastName: Joi.string().trim().max(50),
      company: Joi.string().trim().max(100)
    }).optional(),
    walletAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).optional().messages({
      'string.pattern.base': 'Please provide a valid Ethereum address'
    })
  })
};

// Device validation schemas
const deviceSchemas = {
  register: Joi.object({
    name: Joi.string().trim().max(100).required().messages({
      'string.max': 'Device name must not exceed 100 characters',
      'any.required': 'Device name is required'
    }),
    macAddress: Joi.string().pattern(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/).required().messages({
      'string.pattern.base': 'Please provide a valid MAC address format (XX:XX:XX:XX:XX:XX)',
      'any.required': 'MAC address is required'
    }),
    walletAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required().messages({
      'string.pattern.base': 'Please provide a valid Ethereum address',
      'any.required': 'Wallet address is required'
    }),
    deviceType: Joi.string().valid('sensor', 'actuator', 'gateway', 'hybrid').default('sensor').messages({
      'any.only': 'Device type must be one of: sensor, actuator, gateway, hybrid'
    }),
    location: Joi.object({
      latitude: Joi.number().min(-90).max(90),
      longitude: Joi.number().min(-180).max(180),
      address: Joi.string().trim().max(200)
    }).optional(),
    metadata: Joi.object({
      manufacturer: Joi.string().trim().max(100),
      model: Joi.string().trim().max(100),
      firmwareVersion: Joi.string().trim().max(50),
      serialNumber: Joi.string().trim().max(100)
    }).optional()
  }),

  update: Joi.object({
    name: Joi.string().trim().max(100),
    status: Joi.string().valid('active', 'inactive', 'maintenance', 'error'),
    location: Joi.object({
      latitude: Joi.number().min(-90).max(90),
      longitude: Joi.number().min(-180).max(180),
      address: Joi.string().trim().max(200)
    }),
    metadata: Joi.object({
      manufacturer: Joi.string().trim().max(100),
      model: Joi.string().trim().max(100),
      firmwareVersion: Joi.string().trim().max(50),
      serialNumber: Joi.string().trim().max(100)
    })
  }).min(1).messages({
    'object.min': 'At least one field must be provided for update'
  })
};

// Data validation schemas
const dataSchemas = {
  submit: Joi.object({
    encryptedData: Joi.string().required().messages({
      'any.required': 'Encrypted data is required'
    })
  }),

  query: Joi.object({
    deviceAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).messages({
      'string.pattern.base': 'Please provide a valid Ethereum address'
    }),
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
    aggregationType: Joi.string().valid('hourly', 'daily', 'monthly')
  })
};

// Query parameter validation schemas
const querySchemas = {
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sort: Joi.string().valid('createdAt', '-createdAt', 'name', '-name', 'lastDataTimestamp', '-lastDataTimestamp'),
    status: Joi.string().valid('active', 'inactive', 'maintenance', 'error', 'approved', 'pending')
  })
};

// Validation middleware functions
const validateUser = {
  register: validate(userSchemas.register),
  login: validate(userSchemas.login),
  updateProfile: validate(userSchemas.updateProfile)
};

const validateDevice = {
  register: validate(deviceSchemas.register),
  update: validate(deviceSchemas.update),
  query: validate(dataSchemas.query, 'query')
};

const validateData = {
  submit: validate(dataSchemas.submit),
  query: validate(dataSchemas.query, 'query')
};

const validateQuery = {
  pagination: validate(querySchemas.pagination, 'query')
};

/**
 * Custom validation middleware for complex scenarios (Simplified for demo)
 */
const customValidators = {
  /**
   * Validate date range for data queries
   */
  validateDateRange: (req, res, next) => {
    const { startDate, endDate } = req.query;

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds

      if (end - start > maxRange) {
        return res.status(400).json({
          error: 'Date range cannot exceed 1 year',
          code: 'DATE_RANGE_TOO_LARGE'
        });
      }
    }

    next();
  },

  /**
   * Validate file upload for device firmware
   */
  validateFileUpload: (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({
        error: 'File is required',
        code: 'FILE_MISSING'
      });
    }

    const allowedMimeTypes = ['application/octet-stream', 'application/x-binary'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        error: 'Invalid file type',
        code: 'INVALID_FILE_TYPE'
      });
    }

    if (req.file.size > maxSize) {
      return res.status(400).json({
        error: 'File size exceeds 10MB limit',
        code: 'FILE_TOO_LARGE'
      });
    }

    next();
  }
};

module.exports = {
  validate,
  validateUser,
  validateDevice,
  validateData,
  validateQuery,
  customValidators,
  userSchemas,
  deviceSchemas,
  dataSchemas,
  querySchemas
};