const express = require('express');
const DataController = require('../controllers/dataController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   GET /api/data/latest/:deviceAddress
 * @desc    Get latest data for a device
 * @access  Private
 */
router.get('/latest/:deviceAddress',
  authenticateToken,
  DataController.getLatestData
);

/**
 * @route   GET /api/data/history/:deviceAddress
 * @desc    Get data history for a device
 * @access  Private
 */
router.get('/history/:deviceAddress',
  authenticateToken,
  DataController.getDataHistory
);

/**
 * @route   GET /api/data/all
 * @desc    Get all data (simplified for demo mode)
 * @access  Private
 */
router.get('/all',
  authenticateToken,
  DataController.getAllData
);

/**
 * @route   GET /api/data/:dataId
 * @desc    Get data by ID
 * @access  Private
 */
router.get('/:dataId',
  authenticateToken,
  DataController.getDataById
);

module.exports = router;