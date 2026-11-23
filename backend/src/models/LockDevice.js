const mongoose = require('mongoose');

const lockDeviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  lockId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 100
  },
  walletAddress: {
    type: String,
    required: true,
    unique: true,
    match: [/^0x[a-fA-F0-9]{40}$/, 'Please enter a valid Ethereum address']
  },

  // REAL public key used by user/frontend to wrap AES session key
  publicKeyPem: {
    type: String,
    default: null,
    trim: true
  },

  // Short fingerprint for easier display / verification
  publicKeyFingerprint: {
    type: String,
    default: null,
    trim: true
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
  isOnline: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'offline', 'online', 'maintenance', 'error'],
    default: 'pending'
  },

  blockchainTxHash: {
    type: String,
    match: [/^0x[a-fA-F0-9]{64}$/, 'Please enter a valid transaction hash']
  },

  registeredAt: {
    type: Date,
    default: Date.now
  },
  lastSeenAt: {
    type: Date
  },
  lastCommandAt: {
    type: Date
  },
  lastCommandStatus: {
    type: String,
    enum: ['pending', 'executed', 'failed', 'expired', 'cancelled', null],
    default: null
  },

  location: {
    building: { type: String, trim: true },
    floor: { type: String, trim: true },
    room: { type: String, trim: true },
    address: { type: String, trim: true }
  },

  metadata: {
    manufacturer: { type: String, trim: true },
    model: { type: String, trim: true },
    firmwareVersion: { type: String, trim: true },
    serialNumber: { type: String, trim: true },
    notes: { type: String, trim: true }
  }
}, {
  timestamps: true
});

// Method to convert document to API-friendly JSON
lockDeviceSchema.methods.toProfileJSON = function() {
  return {
    id: this._id,
    name: this.name,
    lockId: this.lockId,
    walletAddress: this.walletAddress,
    publicKeyFingerprint: this.publicKeyFingerprint,
    isApproved: this.isApproved,
    isOnline: this.isOnline,
    status: this.status,
    registeredAt: this.registeredAt,
    lastSeenAt: this.lastSeenAt,
    lastCommandAt: this.lastCommandAt,
    lastCommandStatus: this.lastCommandStatus,
    location: this.location,
    metadata: this.metadata,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

// Method to expose encryption info only
lockDeviceSchema.methods.toEncryptionJSON = function() {
  return {
    id: this._id,
    name: this.name,
    lockId: this.lockId,
    walletAddress: this.walletAddress,
    publicKeyPem: this.publicKeyPem,
    publicKeyFingerprint: this.publicKeyFingerprint,
    isApproved: this.isApproved,
    isOnline: this.isOnline,
    status: this.status
  };
};

// Method to mark lock approved
lockDeviceSchema.methods.approve = function(txHash = null) {
  this.isApproved = true;
  this.status = 'approved';
  if (txHash) {
    this.blockchainTxHash = txHash;
  }
  return this.save();
};

// Method to reject lock
lockDeviceSchema.methods.reject = function() {
  this.isApproved = false;
  this.isOnline = false;
  this.status = 'rejected';
  return this.save();
};

// Method to update heartbeat / online status
lockDeviceSchema.methods.updateHeartbeat = function(isOnline = true) {
  this.isOnline = isOnline;
  this.lastSeenAt = new Date();
  this.status = isOnline ? 'online' : 'offline';
  return this.save();
};

// Method to record latest command status
lockDeviceSchema.methods.updateLastCommand = function(commandStatus) {
  this.lastCommandAt = new Date();
  this.lastCommandStatus = commandStatus;
  return this.save();
};

// Virtual helper
lockDeviceSchema.virtual('isRecentlyOnline').get(function() {
  if (!this.lastSeenAt) return false;
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return this.lastSeenAt > fiveMinutesAgo;
});

// Indexes
lockDeviceSchema.index({ lockId: 1 });
lockDeviceSchema.index({ walletAddress: 1 });
lockDeviceSchema.index({ owner: 1 });
lockDeviceSchema.index({ isApproved: 1 });
lockDeviceSchema.index({ isOnline: 1 });
lockDeviceSchema.index({ status: 1 });
lockDeviceSchema.index({ lastSeenAt: -1 });
lockDeviceSchema.index({ createdAt: -1 });

module.exports = mongoose.model('LockDevice', lockDeviceSchema);