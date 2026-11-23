const mongoose = require('mongoose');

const dataSchema = new mongoose.Schema({
  device: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Device', 
    required: true 
  },
  deviceAddress: {
    type: String,
    required: true,
    match: [/^0x[a-fA-F0-9]{40}$/, 'Please enter a valid Ethereum address']
  },
  encryptedData: {
    type: String,
    required: true
  },
  decryptedData: {
    type: mongoose.Schema.Types.Mixed, // Flexible schema for different sensor data types
    required: true
  },
  blockchainTxHash: {
    type: String,
    required: true,
    unique: true,
    match: [/^0x[a-fA-F0-9]{64}$/, 'Please enter a valid transaction hash']
  },
  blockNumber: {
    type: Number,
    required: true
  },
  blockTimestamp: {
    type: Date,
    required: true
  },
  processingStatus: {
    type: String,
    enum: ['pending', 'processed', 'error'],
    default: 'processed'
  },
  processingError: {
    type: String,
    trim: true
  },
  // Additional metadata about the data
  metadata: {
    source: { type: String, trim: true },
    accuracy: { type: Number, min: 0, max: 1 },
    unit: { type: String, trim: true },
    range: {
      min: Number,
      max: Number
    }
  }
}, {
  timestamps: true
});

// Method to get data profile
dataSchema.methods.toProfileJSON = function() {
  return {
    id: this._id,
    device: this.device,
    deviceAddress: this.deviceAddress,
    decryptedData: this.decryptedData,
    blockchainTxHash: this.blockchainTxHash,
    blockNumber: this.blockNumber,
    blockTimestamp: this.blockTimestamp,
    processingStatus: this.processingStatus,
    metadata: this.metadata,
    createdAt: this.createdAt
  };
};

// Static method to get latest data for a device
dataSchema.statics.getLatestByDevice = async function(deviceAddress, limit = 10) {
  return this.find({ deviceAddress })
    .sort({ blockTimestamp: -1 })
    .limit(limit)
    .populate('device', 'name macAddress owner');
};

// Static method to get data history for a device with date range
dataSchema.statics.getHistoryByDevice = async function(deviceAddress, startDate, endDate, page = 1, limit = 50) {
  const query = {
    deviceAddress,
    blockTimestamp: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  };

  const skip = (page - 1) * limit;
  
  const [data, total] = await Promise.all([
    this.find(query)
      .sort({ blockTimestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate('device', 'name macAddress owner'),
    this.countDocuments(query)
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Static method to get aggregated data for analytics
dataSchema.statics.getAggregatedData = async function(deviceAddress, startDate, endDate, aggregationType) {
  aggregationType = aggregationType || 'hourly';
  const groupBy = {};
  
  switch (aggregationType) {
    case 'hourly':
      groupBy.$dateToString = { format: "%Y-%m-%d %H:00:00", date: "$blockTimestamp" };
      break;
    case 'daily':
      groupBy.$dateToString = { format: "%Y-%m-%d", date: "$blockTimestamp" };
      break;
    case 'monthly':
      groupBy.$dateToString = { format: "%Y-%m", date: "$blockTimestamp" };
      break;
    default:
      groupBy.$dateToString = { format: "%Y-%m-%d %H:00:00", date: "$blockTimestamp" };
  }

  return this.aggregate([
    {
      $match: {
        deviceAddress,
        blockTimestamp: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        },
        processingStatus: 'processed'
      }
    },
    {
      $group: {
        _id: groupBy,
        count: { $sum: 1 },
        avgValue: { $avg: "$decryptedData.value" },
        minValue: { $min: "$decryptedData.value" },
        maxValue: { $max: "$decryptedData.value" },
        firstReading: { $min: "$blockTimestamp" },
        lastReading: { $max: "$blockTimestamp" }
      }
    },
    {
      $sort: { "_id": 1 }
    }
  ]);
};

// Indexes for better query performance
dataSchema.index({ device: 1 });
dataSchema.index({ deviceAddress: 1 });
dataSchema.index({ blockchainTxHash: 1 });
dataSchema.index({ blockTimestamp: -1 });
dataSchema.index({ processingStatus: 1 });
dataSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Data', dataSchema);