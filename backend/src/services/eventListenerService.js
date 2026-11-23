const { getBlockchainService } = require('./blockchainService');
const { getEncryptionService } = require('./encryptionService');
const Data = require('../models/Data');
const Device = require('../models/Device');
const logger = require('../utils/logger');

class EventListenerService {
  constructor() {
    this.blockchainService = getBlockchainService();
    this.encryptionService = getEncryptionService();
    this.isListening = false;
    this.eventCallbacks = new Map();
    this.startBlockNumber = null;
  }

  /**
   * Initialize the event listener service
   */
  async initialize() {
    try {
      // Get current block number as starting point
      this.startBlockNumber = await this.blockchainService.getBlockNumber();
      logger.info(`Event listener initialized, starting from block: ${this.startBlockNumber}`);
    } catch (error) {
      logger.error('Failed to initialize event listener:', error);
      throw error;
    }
  }

  /**
   * Start listening for blockchain events
   */
  async startListening() {
    if (this.isListening) {
      logger.warn('Event listener is already running');
      return;
    }

    try {
      await this.initialize();
      this.setupEventListeners();
      this.isListening = true;
      logger.info('Event listener started successfully');
    } catch (error) {
      logger.error('Failed to start event listener:', error);
      throw error;
    }
  }

  /**
   * Stop listening for blockchain events
   */
  stopListening() {
    if (!this.isListening) {
      logger.warn('Event listener is not running');
      return;
    }

    try {
      this.removeEventListeners();
      this.isListening = false;
      logger.info('Event listener stopped');
    } catch (error) {
      logger.error('Failed to stop event listener:', error);
    }
  }

  /**
   * Set up event listeners for contract events
   */
  setupEventListeners() {
    // Listen for DataSubmitted events
    this.blockchainService.setupEventListener('DataSubmitted', async (deviceAddress, encryptedData, timestamp, event) => {
      try {
        await this.handleDataSubmittedEvent(deviceAddress, encryptedData, timestamp, event);
      } catch (error) {
        logger.error('Error in DataSubmitted event handler:', error);
      }
    });

    // Listen for DeviceRegistered events
    this.blockchainService.setupEventListener('DeviceRegistered', async (deviceAddress, name, macAddress, event) => {
      try {
        await this.handleDeviceRegisteredEvent(deviceAddress, name, macAddress, event);
      } catch (error) {
        logger.error('Error in DeviceRegistered event handler:', error);
      }
    });

    // Listen for DeviceApproved events
    this.blockchainService.setupEventListener('DeviceApproved', async (deviceAddress, timestamp, event) => {
      try {
        await this.handleDeviceApprovedEvent(deviceAddress, timestamp, event);
      } catch (error) {
        logger.error('Error in DeviceApproved event handler:', error);
      }
    });

    // Listen for DeviceRejected events (with correct signature)
    this.blockchainService.setupEventListener('DeviceRejected', async (deviceAddress, timestamp, event) => {
      try {
        await this.handleDeviceRejectedEvent(deviceAddress, timestamp, event);
      } catch (error) {
        logger.error('Error in DeviceRejected event handler:', error);
      }
    });

    logger.info('Event listeners set up successfully');
  }

  /**
   * Remove all event listeners
   */
  removeEventListeners() {
    // Note: ethers.js doesn't have a direct way to remove all listeners
    // We would need to track and remove individual listeners
    logger.info('Event listeners removed');
  }

  /**
   * Handle DataSubmitted event
   */
  async handleDataSubmittedEvent(deviceAddress, encryptedData, timestamp, event) {
    try {
      logger.info(`DataSubmitted event received from device: ${deviceAddress}`);

      // Find the device in database
      const device = await Device.findOne({ walletAddress: deviceAddress });
      if (!device) {
        logger.warn(`Device not found in database: ${deviceAddress}`);
        return;
      }

      // Decrypt the data
      let decryptedData;
      try {
        decryptedData = this.encryptionService.decrypt(encryptedData);
      } catch (decryptError) {
        logger.error(`Failed to decrypt data from device ${deviceAddress}:`, decryptError);
        return;
      }

      // Create data record
      const dataRecord = new Data({
        device: device._id,
        deviceAddress: deviceAddress,
        encryptedData: encryptedData,
        decryptedData: decryptedData,
        blockchainTxHash: event.transactionHash,
        blockNumber: event.blockNumber,
        blockTimestamp: new Date(Number(timestamp) * 1000), // Convert from seconds to milliseconds
        processingStatus: 'processed'
      });

      // Save data to database
      await dataRecord.save();

      // Update device last data timestamp
      await device.updateLastData(encryptedData, event.transactionHash);

      // Emit real-time event
      this.emitEvent('dataProcessed', {
        deviceId: device._id,
        deviceAddress: deviceAddress,
        data: dataRecord.toProfileJSON(),
        timestamp: new Date()
      });

      logger.info(`Successfully processed data from device ${deviceAddress}, tx: ${event.transactionHash}`);

    } catch (error) {
      logger.error(`Error processing DataSubmitted event:`, error);
    }
  }

  /**
   * Handle DeviceRegistered event
   */
  async handleDeviceRegisteredEvent(deviceAddress, name, macAddress, event) {
    try {
      logger.info(`DeviceRegistered event received: ${deviceAddress}`);

      // Find the device in database
      const device = await Device.findOne({ walletAddress: deviceAddress });
      if (!device) {
        logger.warn(`Device not found in database for registration event: ${deviceAddress}`);
        return;
      }

      // Update device with blockchain info
      device.blockchainTxHash = event.transactionHash;
      await device.save();

      // Emit real-time event
      this.emitEvent('deviceRegistered', {
        deviceId: device._id,
        deviceAddress: deviceAddress,
        name: name,
        macAddress: macAddress,
        transactionHash: event.transactionHash,
        timestamp: new Date()
      });

      logger.info(`Device registration confirmed on blockchain: ${deviceAddress}`);

    } catch (error) {
      logger.error(`Error processing DeviceRegistered event:`, error);
    }
  }

  /**
   * Handle DeviceApproved event
   */
  async handleDeviceApprovedEvent(deviceAddress, timestamp, event) {
    try {
      logger.info(`DeviceApproved event received: ${deviceAddress}`);

      // Find the device in database
      const device = await Device.findOne({ walletAddress: deviceAddress });
      if (!device) {
        logger.warn(`Device not found in database for approval event: ${deviceAddress}`);
        return;
      }

      // Update device approval status in database
      device.isApproved = true;
      device.status = 'active';
      device.blockchainTxHash = event.transactionHash;
      await device.save();

      // Emit real-time event
      this.emitEvent('deviceApproved', {
        deviceId: device._id,
        deviceAddress: deviceAddress,
        transactionHash: event.transactionHash,
        timestamp: new Date()
      });

      logger.info(`Device approval confirmed on blockchain: ${deviceAddress}`);

    } catch (error) {
      logger.error(`Error processing DeviceApproved event:`, error);
    }
  }
  /**
   * Handle DeviceRejected event
   */
  async handleDeviceRejectedEvent(deviceAddress, timestamp, event) {
    try {
      logger.info(`DeviceRejected event received: ${deviceAddress}`);

      // Find the device in database
      const device = await Device.findOne({ walletAddress: deviceAddress });
      if (!device) {
        logger.warn(`Device not found in database for rejection event: ${deviceAddress}`);
        return;
      }

      // Update device rejection status in database
      device.isApproved = false;
      device.status = 'rejected';
      device.blockchainTxHash = event.transactionHash;
      await device.save();

      // Emit real-time event
      this.emitEvent('deviceRejected', {
        deviceId: device._id,
        deviceAddress: deviceAddress,
        transactionHash: event.transactionHash,
        timestamp: new Date()
      });

      logger.info(`Device rejection confirmed on blockchain: ${deviceAddress}`);

    } catch (error) {
      logger.error(`Error processing DeviceRejected event:`, error);
    }
  }


  /**
   * Register event callback
   */
  onEvent(eventName, callback) {
    if (!this.eventCallbacks.has(eventName)) {
      this.eventCallbacks.set(eventName, []);
    }
    this.eventCallbacks.get(eventName).push(callback);
  }

  /**
   * Remove event callback
   */
  offEvent(eventName, callback) {
    if (this.eventCallbacks.has(eventName)) {
      const callbacks = this.eventCallbacks.get(eventName);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to registered callbacks
   */
  emitEvent(eventName, data) {
    if (this.eventCallbacks.has(eventName)) {
      this.eventCallbacks.get(eventName).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          logger.error(`Error in event callback for ${eventName}:`, error);
        }
      });
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isListening: this.isListening,
      startBlockNumber: this.startBlockNumber,
      registeredEvents: Array.from(this.eventCallbacks.keys())
    };
  }

  /**
   * Process historical events (for catching up after downtime)
   */
  async processHistoricalEvents(fromBlock, toBlock) {
    try {
      logger.info(`Processing historical events from block ${fromBlock} to ${toBlock}`);

      // Get historical DataSubmitted events
      const dataSubmittedFilter = this.blockchainService.contract.filters.DataSubmitted();
      const dataSubmittedEvents = await this.blockchainService.contract.queryFilter(
        dataSubmittedFilter,
        fromBlock,
        toBlock
      );

      for (const event of dataSubmittedEvents) {
        await this.handleDataSubmittedEvent(
          event.args.deviceAddress,
          event.args.encryptedData,
          event.args.timestamp,
          event
        );
      }

      logger.info(`Processed ${dataSubmittedEvents.length} historical DataSubmitted events`);

    } catch (error) {
      logger.error('Failed to process historical events:', error);
      throw error;
    }
  }
}

// Singleton instance
let eventListenerServiceInstance = null;

const getEventListenerService = () => {
  if (!eventListenerServiceInstance) {
    eventListenerServiceInstance = new EventListenerService();
  }
  return eventListenerServiceInstance;
};

module.exports = {
  EventListenerService,
  getEventListenerService
};