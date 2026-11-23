const BlockchainService = require('./blockchainService');
const crypto = require('crypto');

class DeviceInitializer {
  constructor(blockchainService, deviceId, deviceName, accountAddress, privateKey) {
    this.blockchainService = blockchainService;
    this.deviceId = deviceId;
    this.deviceName = deviceName;
    this.accountAddress = accountAddress;
    this.privateKey = privateKey;
  }

  // Initialize the device by registering it on the blockchain
  async initialize() {
    try {
      console.log(`Initializing device: ${this.deviceId}`);
      
      // Check if device is already registered
      const isRegistered = await this.blockchainService.isDeviceRegistered(this.deviceId);
      
      if (isRegistered) {
        console.log(`Device ${this.deviceId} is already registered. Skipping registration.`);
        return {
          success: true,
          deviceId: this.deviceId,
          message: 'Device already registered'
        };
      }

      // Register the device
      console.log(`Registering device ${this.deviceId} with name: ${this.deviceName}`);
      const receipt = await this.blockchainService.registerDevice(
        this.deviceId,
        this.deviceName,
        this.accountAddress,
        this.privateKey
      );

      return {
        success: true,
        deviceId: this.deviceId,
        transactionHash: receipt.transactionHash,
        publicKey: this.blockchainService.getPublicKey(),
        message: 'Device registered successfully'
      };
    } catch (error) {
      console.error(`Failed to initialize device ${this.deviceId}:`, error.message);
      
      // According to requirements, we should ignore errors, especially if data is already registered
      return {
        success: false,
        deviceId: this.deviceId,
        error: error.message,
        message: 'Device initialization failed, but continuing...'
      };
    }
  }

  // Generate a unique device ID if not provided
  static generateDeviceId() {
    return 'device_' + crypto.randomBytes(16).toString('hex');
  }

  // Generate a random device name if not provided
  static generateDeviceName() {
    const adjectives = ['Smart', 'Intelligent', 'Connected', 'IoT', 'Edge', 'Advanced'];
    const nouns = ['Sensor', 'Device', 'Node', 'Gateway', 'Hub', 'Terminal'];
    const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const randomNum = Math.floor(Math.random() * 1000);
    return `${randomAdj} ${randomNoun} ${randomNum}`;
  }
}

module.exports = DeviceInitializer;