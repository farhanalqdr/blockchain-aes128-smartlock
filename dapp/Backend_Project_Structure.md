# Backend Project Structure for GydPlatform IoT Management

## Overview
This document outlines the recommended project structure for a Node.js/Express.js backend that will interact with the GydPlatform smart contract.

## Directory Structure

```
backend/
├── src/
│   ├── controllers/
│   │   ├── authController.js          # Authentication & user management
│   │   ├── deviceController.js       # Device registration & management
│   │   └── dataController.js         # Sensor data handling
│   ├── middleware/
│   │   ├── auth.js                   # JWT authentication middleware
│   │   ├── validation.js              # Input validation middleware
│   │   └── rateLimit.js             # Rate limiting
│   ├── models/
│   │   ├── User.js                   # User schema (owner, admin, device)
│   │   └── Device.js                 # Device schema
│   ├── routes/
│   │   ├── auth.js                   # Authentication routes
│   │   ├── devices.js                # Device management routes
│   │   └── data.js                   # Data submission routes
│   ├── services/
│   │   ├── blockchainService.js        # Web3 contract interactions
│   │   ├── deviceService.js            # Device business logic
│   │   └── dataService.js              # Data processing logic
│   ├── utils/
│   │   ├── logger.js                 # Logging utility
│   │   ├── encryption.js             # Data encryption/decryption
│   │   └── validators.js             # Input validation functions
│   └── config/
│       ├── database.js               # Database configuration
│       └── contract.js              # Smart contract configuration
├── tests/
│   ├── unit/
│   │   ├── controllers/             # Controller unit tests
│   │   ├── services/               # Service layer tests
│   │   └── utils/                  # Utility function tests
│   ├── integration/
│   │   ├── auth.test.js             # Authentication integration tests
│   │   ├── devices.test.js          # Device management integration tests
│   │   └── data.test.js             # Data submission integration tests
│   └── fixtures/                   # Test data fixtures
├── docs/
│   ├── api.md                      # API documentation
│   ├── deployment.md                # Deployment guide
│   └── troubleshooting.md          # Common issues & solutions
├── scripts/
│   ├── deploy.js                   # Deployment script
│   └── seed.js                     # Database seeding script
├── .env.example                      # Environment variables template
├── .env                              # Environment variables (gitignored)
├── .gitignore                        # Git ignore file
├── package.json                       # Dependencies & scripts
├── server.js                         # Express app entry point
└── README.md                         # Project documentation
```

## Core Files Breakdown

### 1. Entry Point (`server.js`)

```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();

const app = express();

// Security middleware
app.use(helmet());
app.use(compression());
app.use(cors());

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/devices', require('./src/routes/devices'));
app.use('/api/data', require('./src/routes/data'));

// Error handling
app.use((err, req, res, next) => {
  require('./src/utils/logger').error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  require('./src/utils/logger').info(`Server running on port ${PORT}`);
});
```

### 2. Authentication Controller (`src/controllers/authController.js`)

```javascript
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const blockchainService = require('../services/blockchainService');

class AuthController {
  static async registerUser(userData) {
    try {
      // Validate input
      if (!userData.email || !userData.password || !userData.role) {
        throw new Error('Missing required fields');
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        throw new Error('User already exists');
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);

      // Create user
      const user = new User({
        email: userData.email,
        password: hashedPassword,
        role: userData.role,
        isActive: true
      });

      await user.save();

      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return { success: true, token, user: { id: user._id, email: user.email, role: user.role } };
    } catch (error) {
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  static async login(email, password) {
    try {
      // Find user
      const user = await User.findOne({ email });
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        throw new Error('Invalid credentials');
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return { success: true, token, user: { id: user._id, email: user.email, role: user.role } };
    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  static async registerDeviceOwner(deviceData) {
    try {
      // Register device on blockchain first
      const txHash = await blockchainService.registerDevice(deviceData);
      
      // Then save to database
      const device = new Device({
        name: deviceData.name,
        macAddress: deviceData.macAddress,
        walletAddress: deviceData.walletAddress,
        owner: deviceData.userId,
        blockchainTxHash: txHash,
        isApproved: false, // Pending admin approval
        registeredAt: new Date()
      });

      await device.save();

      return { success: true, txHash, deviceId: device._id };
    } catch (error) {
      throw new Error(`Device registration failed: ${error.message}`);
    }
  }
}

module.exports = AuthController;
```

### 3. Device Controller (`src/controllers/deviceController.js`)

```javascript
const Device = require('../models/Device');
const blockchainService = require('../services/blockchainService');
const deviceService = require('../services/deviceService');

class DeviceController {
  static async getDevices(req, res) {
    try {
      const { page = 1, limit = 10, status } = req.query;
      const userId = req.user.userId; // From auth middleware

      let devices = await deviceService.getDevices(userId, { page, limit, status });

      // Add blockchain data
      devices = await Promise.all(devices.map(async (device) => {
        const blockchainData = await blockchainService.getDeviceData(device.walletAddress);
        return {
          ...device.toObject(),
          blockchainStatus: blockchainData.isApproved,
          lastBlockchainUpdate: blockchainData.lastDataTimestamp
        };
      }));

      res.json({
        devices,
        pagination: {
          page,
          limit,
          total: await deviceService.getDeviceCount(userId)
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async submitData(req, res) {
    try {
      const { encryptedData } = req.body;
      const deviceAddress = req.deviceAddress; // From auth middleware

      // Validate device ownership
      const device = await Device.findOne({ 
        walletAddress: deviceAddress, 
        owner: req.user.userId 
      });

      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      // Check if device is approved on blockchain
      const isApproved = await blockchainService.isDeviceApproved(deviceAddress);
      if (!isApproved) {
        return res.status(403).json({ error: 'Device not approved' });
      }

      // Submit to blockchain
      const txHash = await blockchainService.submitData(deviceAddress, encryptedData);

      // Update local record
      await deviceService.updateLastData(device._id, encryptedData, txHash);

      // Emit real-time event
      const eventEmitter = require('../utils/eventEmitter');
      eventEmitter.emit('dataSubmitted', {
        deviceId: device._id,
        deviceAddress,
        encryptedData,
        txHash,
        timestamp: new Date()
      });

      res.json({
        success: true,
        txHash,
        message: 'Data submitted successfully'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getDeviceStatus(req, res) {
    try {
      const { deviceAddress } = req.params;
      const userId = req.user.userId;

      const device = await Device.findOne({ 
        walletAddress: deviceAddress, 
        owner: userId 
      });

      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      const blockchainStatus = await blockchainService.isDeviceApproved(deviceAddress);

      res.json({
        device: device.toObject(),
        blockchainStatus,
        lastUpdate: device.lastDataTimestamp
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = DeviceController;
```

### 4. Blockchain Service (`src/services/blockchainService.js`)

```javascript
const { ethers } = require('ethers');
const contractConfig = require('../config/contract');

class BlockchainService {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    this.contract = new ethers.Contract(
      contractConfig.address,
      contractConfig.abi,
      this.provider
    );
  }

  async registerDevice(deviceData) {
    try {
      const tx = await this.contract.registerDevice(
        deviceData.name,
        deviceData.macAddress
      );
      
      const receipt = await tx.wait();
      return receipt.transactionHash;
    } catch (error) {
      throw new Error(`Blockchain registration failed: ${error.message}`);
    }
  }

  async approveDevice(deviceAddress) {
    try {
      const tx = await this.contract.approveDevice(deviceAddress);
      await tx.wait();
      return true;
    } catch (error) {
      throw new Error(`Device approval failed: ${error.message}`);
    }
  }

  async isDeviceApproved(deviceAddress) {
    try {
      return await this.contract.isDeviceApproved(deviceAddress);
    } catch (error) {
      throw new Error(`Status check failed: ${error.message}`);
    }
  }

  async submitData(deviceAddress, encryptedData) {
    try {
      const tx = await this.contract.submitEncryptedData(encryptedData);
      const receipt = await tx.wait();
      return receipt.transactionHash;
    } catch (error) {
      throw new Error(`Data submission failed: ${error.message}`);
    }
  }

  async getDeviceData(deviceAddress) {
    try {
      const [currentData, lastTimestamp] = await this.contract.getDeviceData(deviceAddress);
      return {
        currentEncryptedData: currentData,
        lastDataTimestamp: Number(lastTimestamp),
        isApproved: await this.isDeviceApproved(deviceAddress)
      };
    } catch (error) {
      throw new Error(`Data retrieval failed: ${error.message}`);
    }
  }
}

module.exports = BlockchainService;
```

### 5. Device Model (`src/models/Device.js`)

```javascript
const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  macAddress: { type: String, required: true, unique: true },
  walletAddress: { type: String, required: true, unique: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isApproved: { type: Boolean, default: false },
  blockchainTxHash: { type: String },
  registeredAt: { type: Date, default: Date.now },
  lastDataTimestamp: { type: Date },
  lastEncryptedData: { type: String },
  dataCount: { type: Number, default: 0 }
}, {
  timestamps: true
});

deviceSchema.index({ macAddress: 1 });
deviceSchema.index({ walletAddress: 1 });
deviceSchema.index({ owner: 1 });

module.exports = mongoose.model('Device', deviceSchema);
```

### 6. API Routes (`src/routes/devices.js`)

```javascript
const express = require('express');
const DeviceController = require('../controllers/deviceController');
const authMiddleware = require('../middleware/auth');
const validateDevice = require('../middleware/validation');

const router = express.Router();

// Get all devices for authenticated user
router.get('/', authMiddleware, DeviceController.getDevices);

// Get specific device status
router.get('/status/:deviceAddress', authMiddleware, DeviceController.getDeviceStatus);

// Submit sensor data
router.post('/data', 
  authMiddleware,
  validateDevice.submitData,
  DeviceController.submitData
);

// Register new device (device owner only)
router.post('/register', 
  authMiddleware,
  validateDevice.register,
  DeviceController.registerDevice
);

module.exports = router;
```

### 7. Package.json (`package.json`)

```json
{
  "name": "gydplatform-backend",
  "version": "1.0.0",
  "description": "Backend for GydPlatform IoT Device Management",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "deploy": "node scripts/deploy.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "compression": "^1.7.4",
    "mongoose": "^7.5.0",
    "ethers": "^6.8.0",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "joi": "^17.9.2",
    "winston": "^3.10.0",
    "dotenv": "^16.3.1",
    "express-rate-limit": "^7.1.5"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",
    "jest": "^29.5.5",
    "supertest": "^6.3.3"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}
```

### 8. Environment Variables (`.env.example`)

```bash
# Server Configuration
NODE_ENV=development
PORT=3000

# Blockchain Configuration
RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
CONTRACT_ADDRESS=0x123456789012345678901234567890
PRIVATE_KEY=your_private_key_here

# Database Configuration
DATABASE_URL=mongodb://localhost:27017/gydplatform
DATABASE_NAME=gydplatform

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=24h

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=./logs/app.log
```

### 9. Docker Configuration (`Dockerfile`)

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Create non-root user
RUN addgroup -g nodejs && adduser -g nodejs -G nodejs -s /bin/sh
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "start"]
```

### 10. Docker Compose (`docker-compose.yml`)

```yaml
version: '3.8'

services:
  backend:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - RPC_URL=${RPC_URL}
      - CONTRACT_ADDRESS=${CONTRACT_ADDRESS}
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - mongodb
      - blockchain
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped

  mongodb:
    image: mongo:6.0
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    environment:
      - MONGO_INITDB_DATABASE=gydplatform
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=password

  blockchain:
    image: node:18-alpine
    command: >
      sh -c "
        apk add --no-cache curl
        && curl -X POST -H 'Content-Type: application/json' 
           -d '{\"jsonrpc\":\"2.0\",\"method\":\"eth_blockNumber\",\"params\":[],\"id\":1}' 
           ${RPC_URL}
        && echo 'Blockchain node is running'
      "
    environment:
      - RPC_URL=${RPC_URL}
```

## Development Workflow

### 1. Setup Development Environment

```bash
# Clone the repository
git clone <repository-url>
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Edit .env with your local configuration

# Start database (MongoDB required)
mongod --dbpath ./data/db

# Start development server
npm run dev
```

### 2. Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage
```

### 3. Production Deployment

```bash
# Build Docker image
docker build -t gydplatform-backend .

# Deploy with Docker Compose
docker-compose up -d

# Or deploy to cloud service
# (AWS, Google Cloud, Azure, etc.)
```

## API Documentation Structure

All API endpoints should be documented using OpenAPI/Swagger:

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Token refresh

### Device Management Endpoints
- `GET /api/devices` - List user's devices
- `POST /api/devices/register` - Register new device
- `GET /api/devices/status/:address` - Get device status
- `POST /api/devices/data` - Submit sensor data

### Data Endpoints
- `GET /api/data/latest/:deviceAddress` - Get latest device data
- `GET /api/data/history/:deviceAddress` - Get data history
- `WebSocket /ws/data` - Real-time data stream

This backend structure provides a solid foundation for building a scalable IoT device management system with proper separation of concerns, security measures, and production-ready deployment configurations.