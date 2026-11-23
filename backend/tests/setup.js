const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// Setup in-memory MongoDB for testing
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

// Cleanup after all tests
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// Clear database between tests
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

// Global test utilities
global.testUtils = {
  // Create test user
  createTestUser: async (userData = {}) => {
    const User = require('../src/models/User');
    const defaultUser = {
      email: 'test@example.com',
      password: 'password123',
      role: 'owner',
      ...userData
    };
    return User.create(defaultUser);
  },

  // Create test device
  createTestDevice: async (deviceData = {}) => {
    const Device = require('../src/models/Device');
    const user = await global.testUtils.createTestUser();
    const defaultDevice = {
      name: 'Test Device',
      macAddress: '00:11:22:33:44:55',
      walletAddress: '0x1234567890123456789012345678901234567890',
      owner: user._id,
      ...deviceData
    };
    return Device.create(defaultDevice);
  },

  // Create test data
  createTestData: async (dataData = {}) => {
    const Data = require('../src/models/Data');
    const device = await global.testUtils.createTestDevice();
    const defaultData = {
      device: device._id,
      deviceAddress: device.walletAddress,
      encryptedData: 'encrypted_test_data',
      decryptedData: { value: 25, unit: '°C' },
      blockchainTxHash: '0x' + 'ab'.repeat(32),
      blockNumber: 12345,
      blockTimestamp: new Date(),
      dataType: 'temperature',
      ...dataData
    };
    return Data.create(defaultData);
  },

  // Generate JWT token for testing
  generateTestToken: (userId, email, role = 'owner') => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      { userId, email, role },
      process.env.JWT_SECRET || 'test_secret',
      { expiresIn: '1h' }
    );
  }
};