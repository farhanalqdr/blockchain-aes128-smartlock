const Device = require('../models/Device');
const { getBlockchainService } = require('../services/blockchainService');
const { getEncryptionService } = require('../services/encryptionService');
const logger = require('../utils/logger');

class DeviceController {
  /**
   * Register a new device metadata (device handles blockchain registration itself)
   */
  static async registerDevice(req, res) {
    try {
      const { name, macAddress, walletAddress, location, metadata } = req.body;

      // Check if MAC address already exists
      const existingMacDevice = await Device.findOne({ macAddress });
      if (existingMacDevice) {
        return res.status(409).json({
          error: 'Device with this MAC address already exists',
          code: 'MAC_ADDRESS_EXISTS'
        });
      }

      // Check if wallet address already exists
      const existingWalletDevice = await Device.findOne({ walletAddress });
      if (existingWalletDevice) {
        return res.status(409).json({
          error: 'Device with this wallet address already exists',
          code: 'WALLET_ADDRESS_EXISTS'
        });
      }

      // Create device metadata in database (device will register itself on blockchain)
      const device = new Device({
        name,
        macAddress,
        walletAddress,
        owner: req.user.userId, // Track owner for reference when registered through API
        location,
        metadata,
        isApproved: false, // Pending blockchain registration and admin approval
        registeredAt: new Date()
      });

      await device.save();

      logger.info(`Device metadata registered: ${name} by user ${req.user.userId}`);

      res.status(201).json({
        success: true,
        message: 'Device metadata registered successfully. Please register the device on blockchain using the provided wallet address.',
        device: device.toProfileJSON(),
        instructions: {
          step1: 'Use your device to register on the blockchain smart contract',
          step2: 'Wait for blockchain confirmation',
          step3: 'Backend will automatically detect registration via event listener',
          step4: 'Admin can then approve the device'
        }
      });

    } catch (error) {
      logger.error('Device registration error:', error);
      res.status(500).json({
        error: 'Device registration failed',
        code: 'DEVICE_REGISTRATION_ERROR',
        message: error.message
      });
    }
  }

  /**
   * Get all devices for the authenticated user
   */
  static async getDevices(req, res) {
    try {
      const { page = 1, limit = 10, status, sort = '-createdAt' } = req.query;

      // Build query - in demo mode, all users can see all devices
      const query = {};
      if (status) {
        if (status === 'approved') {
          query.isApproved = true;
        } else if (status === 'pending') {
          query.isApproved = false;
        } else {
          query.status = status;
        }
      }

      // Parse pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Get devices
      const [devices, total] = await Promise.all([
        Device.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limitNum)
          .populate('owner', 'email profile'), // owner may be null for blockchain-created devices
        Device.countDocuments(query)
      ]);

      // Add blockchain data for each device
      const blockchainService = getBlockchainService();
      const devicesWithBlockchain = await Promise.all(devices.map(async (device) => {
        try {
          const blockchainData = await blockchainService.getDeviceData(device.walletAddress);
          return {
            ...device.toProfileJSON(),
            blockchainStatus: blockchainData.isApproved,
            lastBlockchainUpdate: blockchainData.lastDataTimestamp,
            currentEncryptedData: blockchainData.currentEncryptedData
          };
        } catch (blockchainError) {
          logger.warn(`Failed to get blockchain data for device ${device.walletAddress}:`, blockchainError);
          return {
            ...device.toProfileJSON(),
            blockchainStatus: null,
            blockchainError: true
          };
        }
      }));

      res.json({
        success: true,
        devices: devicesWithBlockchain,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });

    } catch (error) {
      logger.error('Get devices error:', error);
      res.status(500).json({
        error: 'Failed to get devices',
        code: 'GET_DEVICES_ERROR',
        message: error.message
      });
    }
  }

  /**
   * Get specific device details
   */
  static async getDevice(req, res) {
    try {
      const { deviceId } = req.params;

      const device = await Device.findOne({ _id: deviceId });
      if (!device) {
        return res.status(404).json({
          error: 'Device not found',
          code: 'DEVICE_NOT_FOUND'
        });
      }

      // Get blockchain data
      const blockchainService = getBlockchainService();
      let blockchainData = null;
      
      try {
        blockchainData = await blockchainService.getDeviceInfo(device.walletAddress);
      } catch (blockchainError) {
        logger.warn(`Failed to get blockchain info for device ${device.walletAddress}:`, blockchainError);
      }

      const deviceResponse = {
        ...device.toProfileJSON(),
        blockchainInfo: blockchainData
      };

      res.json({
        success: true,
        device: deviceResponse
      });

    } catch (error) {
      logger.error('Get device error:', error);
      res.status(500).json({
        error: 'Failed to get device',
        code: 'GET_DEVICE_ERROR',
        message: error.message
      });
    }
  }

  /**
   * Get device status
   */
  static async getDeviceStatus(req, res) {
    try {
      const { deviceAddress } = req.params;

      const device = await Device.findOne({
        walletAddress: deviceAddress
      });

      if (!device) {
        return res.status(404).json({
          error: 'Device not found',
          code: 'DEVICE_NOT_FOUND'
        });
      }

      // Get blockchain status
      const blockchainService = getBlockchainService();
      let blockchainStatus = false;
      
      try {
        blockchainStatus = await blockchainService.isDeviceApproved(deviceAddress);
      } catch (blockchainError) {
        logger.warn(`Failed to check blockchain status for device ${deviceAddress}:`, blockchainError);
      }

      const status = {
        device: device.toProfileJSON(),
        blockchainStatus,
        isOnline: device.isOnline,
        lastUpdate: device.lastDataTimestamp,
        dataCount: device.dataCount
      };

      res.json({
        success: true,
        status
      });

    } catch (error) {
      logger.error('Get device status error:', error);
      res.status(500).json({
        error: 'Failed to get device status',
        code: 'GET_DEVICE_STATUS_ERROR',
        message: error.message
      });
    }
  }

  /**
   * Approve device (admin only)
   */
  static async approveDevice(req, res) {
    try {
      const { deviceAddress } = req.params;

      const device = await Device.findOne({ walletAddress: deviceAddress });
      if (!device) {
        return res.status(404).json({
          error: 'Device not found',
          code: 'DEVICE_NOT_FOUND'
        });
      }

      // Approve device on blockchain
      const blockchainService = getBlockchainService();
      let blockchainResult;
      
      try {
        blockchainResult = await blockchainService.approveDevice(deviceAddress);
      } catch (blockchainError) {
        logger.error('Blockchain device approval failed:', blockchainError);
        return res.status(500).json({
          error: 'Blockchain approval failed',
          code: 'BLOCKCHAIN_ERROR',
          message: blockchainError.message
        });
      }

      // Note: Device status will be updated by the event listener when the blockchain transaction is confirmed
      logger.info(`Device approval transaction sent: ${deviceAddress} by admin ${req.user.userId}`);

      res.json({
        success: true,
        message: 'Device approved successfully',
        device: device.toProfileJSON(),
        blockchain: blockchainResult
      });

    } catch (error) {
      logger.error('Approve device error:', error);
      res.status(500).json({
        error: 'Failed to approve device',
        code: 'APPROVE_DEVICE_ERROR',
        message: error.message
      });
    }
  }

  /**
   * Reject device (admin only)
   */
  static async rejectDevice(req, res) {
    try {
      const { deviceAddress } = req.params;

      const device = await Device.findOne({ walletAddress: deviceAddress });
      if (!device) {
        return res.status(404).json({
          error: 'Device not found',
          code: 'DEVICE_NOT_FOUND'
        });
      }

      // Reject device on blockchain
      const blockchainService = getBlockchainService();
      let blockchainResult;
      
      try {
        blockchainResult = await blockchainService.rejectDevice(deviceAddress);
      } catch (blockchainError) {
        logger.error('Blockchain device rejection failed:', blockchainError);
        return res.status(500).json({
          error: 'Blockchain rejection failed',
          code: 'BLOCKCHAIN_ERROR',
          message: blockchainError.message
        });
      }
      // Note: Device status will be updated by the event listener when the blockchain transaction is confirmed
      logger.info(`Device rejection transaction sent: ${deviceAddress} by admin ${req.user.userId}`);

      res.json({
        success: true,
        message: 'Device rejection transaction sent',
        device: device.toProfileJSON(),
        blockchain: blockchainResult
      });

    } catch (error) {
      logger.error('Reject device error:', error);
      res.status(500).json({
        error: 'Failed to reject device',
        code: 'REJECT_DEVICE_ERROR',
        message: error.message
      });
    }
  }

  /**
   * Get all devices (simplified for demo mode)
   */
  static async getAllDevices(req, res) {
    try {
      const { page = 1, limit = 10, status, sort = '-createdAt' } = req.query;

      // Build query
      const query = {};
      if (status) {
        if (status === 'approved') {
          query.isApproved = true;
        } else if (status === 'pending') {
          query.isApproved = false;
        } else {
          query.status = status;
        }
      }

      // Parse pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Get devices
      const [devices, total] = await Promise.all([
        Device.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limitNum)
          .populate('owner', 'email profile'), // owner may be null for blockchain-created devices
        Device.countDocuments(query)
      ]);

      res.json({
        success: true,
        devices: devices.map(device => device.toProfileJSON()),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });

    } catch (error) {
      logger.error('Get all devices error:', error);
      res.status(500).json({
        error: 'Failed to get devices',
        code: 'GET_ALL_DEVICES_ERROR',
        message: error.message
      });
    }
  }
}

module.exports = DeviceController;