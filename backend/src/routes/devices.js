const express = require('express');
const Device = require('../models/Device');
const DeviceController = require('../controllers/deviceController');
const { authenticateToken } = require('../middleware/auth');
const { blockchainLimiter } = require('../middleware/rateLimit');

const router = express.Router();

/**
 * @route   POST /api/devices/register
 * @desc    Register a new device
 * @access  Private (all authenticated users are admins in demo mode)
 */
/**
 * @route   GET /api/devices
 * @desc    Get all devices for authenticated user
 * @access  Private
 */
router.get('/',
  authenticateToken,
  DeviceController.getDevices
);

/**
 * @route   GET /api/devices/all
 * @desc    Get all devices (simplified demo mode)
 * @access  Private
 */
router.get('/all',
  authenticateToken,
  DeviceController.getAllDevices
);

/**
 * @route   GET /api/devices/status/:deviceAddress
 * @desc    Get device status
 * @access  Private
 */
router.get('/status/:deviceAddress',
  authenticateToken,
  DeviceController.getDeviceStatus
);

/**
 * @route   GET /api/devices/:deviceId
 * @desc    Get specific device details
 * @access  Private
 */
router.get('/:deviceId',
  authenticateToken,
  DeviceController.getDevice
);

/**
 * @route   POST /api/devices/reject/:deviceAddress
 * @desc    Reject device
 * @access  Private (all authenticated users are admins in demo mode)
 */
router.post('/reject/:deviceAddress',
  authenticateToken,
  DeviceController.rejectDevice
);

/**
 * @route   POST /api/devices/approve/:deviceAddress
 * @desc    Approve device on blockchain
 * @access  Private (all authenticated users are admins in demo mode)
 */
router.post('/approve/:deviceAddress',
  authenticateToken,
  DeviceController.approveDevice
);

// Note: Data submission endpoint removed as devices submit data directly to blockchain
// This endpoint is available in data routes for admin use only

/**
 * @route   GET /api/devices/search
 * @desc    Search devices by name or MAC address
 * @access  Private
 */
router.get('/search',
  authenticateToken,
  async (req, res) => {
    try {
      const { q, page = 1, limit = 10 } = req.query;

      if (!q) {
        return res.status(400).json({
          error: 'Search query is required',
          code: 'SEARCH_QUERY_REQUIRED'
        });
      }

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      const searchRegex = new RegExp(q, 'i');
      const [devices, total] = await Promise.all([
        Device.find({
          $or: [
            { name: { $regex: searchRegex } },
            { macAddress: { $regex: searchRegex } }
          ]
        })
          .sort({ name: 1 })
          .skip(skip)
          .limit(limitNum),
        Device.countDocuments({
          $or: [
            { name: { $regex: searchRegex } },
            { macAddress: { $regex: searchRegex } }
          ]
        })
      ]);

      res.json(devices.map(device => device.toProfileJSON()));

    } catch (error) {
      const logger = require('../utils/logger');
      logger.error('Device search error:', error);
      res.status(500).json({
        error: 'Search failed',
        code: 'SEARCH_ERROR',
        message: error.message
      });
    }
  }
);

module.exports = router;