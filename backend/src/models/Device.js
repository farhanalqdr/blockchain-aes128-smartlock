const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100
  },
  macAddress: { 
    type: String, 
    required: true, 
    unique: true,
    match: [/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, 'Please enter a valid MAC address']
  },
  walletAddress: { 
    type: String, 
    required: true, 
    unique: true,
    match: [/^0x[a-fA-F0-9]{40}$/, 'Please enter a valid Ethereum address']
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  isApproved: { 
    type: Boolean, 
    default: false 
  },
  blockchainTxHash: { 
    type: String, 
    match: [/^0x[a-fA-F0-9]{64}$/, 'Please enter a valid transaction hash']
  },
  registeredAt: { 
    type: Date, 
    default: Date.now 
  },
  lastDataTimestamp: { 
    type: Date 
  },
  lastEncryptedData: { 
    type: String 
  },
  dataCount: { 
    type: Number, 
    default: 0 
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending', 'maintenance', 'error', 'rejected'],
    default: 'inactive'
  },
  location: {
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
    address: { type: String, trim: true }
  },
  metadata: {
    manufacturer: { type: String, trim: true },
    model: { type: String, trim: true },
    firmwareVersion: { type: String, trim: true },
    serialNumber: { type: String, trim: true }
  }
}, {
  timestamps: true
});

// Method to get device profile with related data
deviceSchema.methods.toProfileJSON = function() {
  return {
    id: this._id,
    name: this.name,
    macAddress: this.macAddress,
    walletAddress: this.walletAddress,
    isApproved: this.isApproved,
    status: this.status,
    registeredAt: this.registeredAt,
    lastDataTimestamp: this.lastDataTimestamp,
    dataCount: this.dataCount,
    location: this.location,
    metadata: this.metadata
  };
};

// Method to update last data submission
deviceSchema.methods.updateLastData = function(encryptedData, txHash) {
  this.lastEncryptedData = encryptedData;
  this.lastDataTimestamp = new Date();
  this.dataCount += 1;
  this.blockchainTxHash = txHash;
  return this.save();
};

// Method to approve device
deviceSchema.methods.approve = function() {
  this.isApproved = true;
  this.status = 'active';
  return this.save();
};

// Virtual for checking if device is online (based on last data submission)
deviceSchema.virtual('isOnline').get(function() {
  if (!this.lastDataTimestamp) return false;
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return this.lastDataTimestamp > fiveMinutesAgo;
});

// Indexes for better query performance
deviceSchema.index({ macAddress: 1 });
deviceSchema.index({ walletAddress: 1 });
deviceSchema.index({ owner: 1 });
deviceSchema.index({ isApproved: 1 });
deviceSchema.index({ status: 1 });
deviceSchema.index({ lastDataTimestamp: 1 });

module.exports = mongoose.model('Device', deviceSchema);