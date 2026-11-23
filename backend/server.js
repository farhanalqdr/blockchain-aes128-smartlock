require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

// Import configurations and services
const connectDB = require('./src/config/database');
const { getEncryptionService } = require('./src/services/encryptionService');
const { getBlockchainService } = require('./src/services/blockchainService');
const { getPendingCommandExpiryService } = require('./src/services/pendingCommandExpiryService');
const { seedAdmin } = require('./src/scripts/seedAdmin');
const logger = require('./src/utils/logger');

// Import routes
const authRoutes = require('./src/routes/auth');
const deviceRoutes = require('./src/routes/devices');
const dataRoutes = require('./src/routes/data');
const commandRoutes = require('./src/routes/commands');
const lockRoutes = require('./src/routes/locks');

// Create Express app
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// Compression middleware
app.use(compression());

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:5173'
        ];

    if (process.env.NODE_ENV === 'development' || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Device-Address',
    'X-Device-Signature',
    'X-Timestamp'
  ]
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/commands', commandRoutes);
app.use('/api/locks', lockRoutes);

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'GydPlatform Smartlock API',
    version: '2.1.0',
    description: 'Backend API for smartlock command management and encrypted command processing',
    endpoints: {
      auth: '/api/auth',
      devices: '/api/devices',
      data: '/api/data',
      commands: '/api/commands',
      locks: '/api/locks',
      health: '/health',
      publicKey: '/api/auth/public-key'
    },
    notes: [
      'Device and data routes are still available during migration.',
      'Lock routes are the new smartlock-oriented backend routes.',
      'Command routes are the new smartlock-oriented backend routes.',
      'Command expiration duration is determined by web dApp through expiresInSeconds.',
      'Expired pending commands are automatically marked as expired by backend service.'
    ]
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('public'));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    path: req.originalUrl,
    method: req.method
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: err.errors
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid data format',
      code: 'CAST_ERROR'
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      error: 'Duplicate entry',
      code: 'DUPLICATE_ENTRY'
    });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  try {
    const mongoose = require('mongoose');

    try {
      const pendingCommandExpiryService = getPendingCommandExpiryService();
      await pendingCommandExpiryService.stop();
    } catch (expiryError) {
      logger.warn('Pending command expiry service stop skipped:', expiryError.message);
    }

    await mongoose.connection.close();
    logger.info('Database connection closed');

    try {
      const blockchainService = getBlockchainService();
      await blockchainService.stopEventListener();
      logger.info('Blockchain event listener stopped');
    } catch (listenerError) {
      logger.warn('Blockchain event listener stop skipped:', listenerError.message);
    }

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

// Start server
const startServer = async () => {
  try {
    await connectDB();
    logger.info('Database connected successfully');

    await seedAdmin();
    logger.info('Admin user seeding completed');

    getEncryptionService();
    logger.info('Encryption service initialized');

    const pendingCommandExpiryService = getPendingCommandExpiryService();
    await pendingCommandExpiryService.start();
    logger.info('Pending command expiry service initialized');

    try {
      const blockchainService = getBlockchainService();
      const blockchainStatus = await blockchainService.checkConnection();

      if (!blockchainStatus.connected) {
        logger.warn('Blockchain service not connected:', blockchainStatus.error);
      } else {
        logger.info('Blockchain service connected');

        try {
          await blockchainService.startEventListener();
          logger.info('Blockchain event listener started');
        } catch (listenerError) {
          logger.warn('Blockchain event listener could not start yet (migration in progress):', listenerError.message);
        }
      }
    } catch (blockchainError) {
      logger.warn('Blockchain service initialization skipped (migration in progress):', blockchainError.message);
    }

    const PORT = process.env.PORT || 3000;
    const HOST = process.env.HOST || '0.0.0.0';

    app.listen(PORT, HOST, () => {
      logger.info(`Server running on http://${HOST}:${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`API documentation available at: http://${HOST}:${PORT}/api`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;