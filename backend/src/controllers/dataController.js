const Data = require('../models/Data');
const Device = require('../models/Device');
const logger = require('../utils/logger');

class DataController {
  /**
   * Get latest data for a device
   */
  static async getLatestData(req, res) {
    try {
      const { deviceAddress } = req.params;

      // In demo mode, all users can access all devices
      const device = await Device.findOne({
        walletAddress: deviceAddress
      });

      if (!device) {
        return res.status(404).json({
          error: 'Device not found',
          code: 'DEVICE_NOT_FOUND'
        });
      }

      // Get latest data
      const latestData = await Data.getLatestByDevice(deviceAddress, 1);

      if (latestData.length === 0) {
        return res.json({
          success: true,
          data: null,
          message: 'No data found for this device'
        });
      }

      res.json({
        success: true,
        data: latestData[0].toProfileJSON()
      });

    } catch (error) {
      logger.error('Get latest data error:', error);
      res.status(500).json({
        error: 'Failed to get latest data',
        code: 'GET_LATEST_DATA_ERROR',
        message: error.message
      });
    }
  }

  /**
   * Get data history for a device
   */
  static async getDataHistory(req, res) {
    try {
      const { deviceAddress } = req.params;
      const {
        startDate,
        endDate,
        page = 1,
        limit = 50
      } = req.query;

      // In demo mode, all users can access all devices
      const device = await Device.findOne({
        walletAddress: deviceAddress
      });

      if (!device) {
        return res.status(404).json({
          error: 'Device not found',
          code: 'DEVICE_NOT_FOUND'
        });
      }

      // Set default date range if not provided
      const defaultStartDate = new Date();
      defaultStartDate.setDate(defaultStartDate.getDate() - 7); // Last 7 days
      const defaultEndDate = new Date();

      const queryStartDate = startDate ? new Date(startDate) : defaultStartDate;
      const queryEndDate = endDate ? new Date(endDate) : defaultEndDate;

      // Build query
      let query = Data.find({ 
        deviceAddress,
        blockTimestamp: {
          $gte: queryStartDate,
          $lte: queryEndDate
        }
      });


      // Parse pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Get data
      const [data, total] = await Promise.all([
        query
          .sort({ blockTimestamp: -1 })
          .skip(skip)
          .limit(limitNum)
          .populate('device', 'name macAddress'),
        Data.countDocuments(query.getQuery())
      ]);

      res.json({
        success: true,
        data: data.map(item => item.toProfileJSON()),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        },
        dateRange: {
          startDate: queryStartDate,
          endDate: queryEndDate
        }
      });

    } catch (error) {
      logger.error('Get data history error:', error);
      res.status(500).json({
        error: 'Failed to get data history',
        code: 'GET_DATA_HISTORY_ERROR',
        message: error.message
      });
    }
  }

  /**
   * Get all data (simplified for demo mode)
   */
  static async getAllData(req, res) {
    try {
      const { page = 1, limit = 50, deviceAddress, startDate, endDate } = req.query;

      // Build query
      let query = {};
      if (deviceAddress) {
        query.deviceAddress = deviceAddress;
      }
      if (startDate || endDate) {
        query.blockTimestamp = {};
        if (startDate) {
          query.blockTimestamp.$gte = new Date(startDate);
        }
        if (endDate) {
          query.blockTimestamp.$lte = new Date(endDate);
        }
      }

      // Parse pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Get data
      const [data, total] = await Promise.all([
        Data.find(query)
          .sort({ blockTimestamp: -1 })
          .skip(skip)
          .limit(limitNum)
          .populate('device', 'name macAddress'),
        Data.countDocuments(query)
      ]);

      res.json({
        success: true,
        data: data.map(item => item.toProfileJSON()),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });

    } catch (error) {
      logger.error('Get all data error:', error);
      res.status(500).json({
        error: 'Failed to get all data',
        code: 'GET_ALL_DATA_ERROR',
        message: error.message
      });
    }
  }

  /**
   * Get data by ID
   */
  static async getDataById(req, res) {
    try {
      const { dataId } = req.params;

      // Find data by ID
      const data = await Data.findById(dataId).populate('device', 'name macAddress');

      if (!data) {
        return res.status(404).json({
          error: 'Data not found',
          code: 'DATA_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        data: data.toProfileJSON()
      });

    } catch (error) {
      logger.error('Get data by ID error:', error);
      res.status(500).json({
        error: 'Failed to get data',
        code: 'GET_DATA_BY_ID_ERROR',
        message: error.message
      });
    }
  }
}

module.exports = DataController;