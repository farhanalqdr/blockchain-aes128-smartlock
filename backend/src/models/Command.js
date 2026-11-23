const mongoose = require('mongoose');

const commandSchema = new mongoose.Schema({
  lockDevice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LockDevice',
    required: true
  },
  lockAddress: {
    type: String,
    required: true,
    match: [/^0x[a-fA-F0-9]{40}$/, 'Please enter a valid Ethereum address']
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  submittedByAddress: {
    type: String,
    required: true,
    match: [/^0x[a-fA-F0-9]{40}$/, 'Please enter a valid Ethereum address']
  },

  commandType: {
    type: String,
    required: true,
    enum: ['LOCK', 'UNLOCK']
  },

  // RAW payload intentionally stored for debugging / verification
  // This weakens confidentiality, so use only for test/demo
  rawPayload: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },

  encryptedPayload: {
    type: String,
    required: true
  },
  // Compatibility-only field because current contract still expects it
  encryptedSessionKey: {
    type: String,
    required: true
  },
  iv: {
    type: String,
    required: true
  },
  authTag: {
    type: String,
    required: true
  },

  nonce: {
    type: String,
    required: true,
    trim: true
  },
  payloadHash: {
    type: String,
    trim: true
  },

  expiresAt: {
    type: Date,
    required: true
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },

  status: {
    type: String,
    enum: ['pending', 'executed', 'failed', 'expired', 'cancelled'],
    default: 'pending'
  },
  executionResult: {
    type: String,
    trim: true
  },
  executedAt: {
    type: Date
  },
  executedByLockAddress: {
    type: String,
    match: [/^0x[a-fA-F0-9]{40}$/, 'Please enter a valid Ethereum address']
  },

  blockchainCommandId: {
    type: Number
  },
  blockchainTxHash: {
    type: String,
    unique: true,
    sparse: true,
    match: [/^0x[a-fA-F0-9]{64}$/, 'Please enter a valid transaction hash']
  },
  blockNumber: {
    type: Number
  },
  blockTimestamp: {
    type: Date
  },

  executionSyncedOnChain: {
    type: Boolean,
    default: false
  },
  onChainExecutionTxHash: {
    type: String,
    sparse: true,
    match: [/^0x[a-fA-F0-9]{64}$/, 'Please enter a valid transaction hash']
  },
  onChainExecutionBlockNumber: {
    type: Number
  },
  onChainExecutionBlockTimestamp: {
    type: Date
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

  encryption: {
    payloadAlgorithm: {
      type: String,
      default: 'AES-128-GCM'
    },
    keyMode: {
      type: String,
      default: 'SYMMETRIC_SHARED_KEY'
    },
    keyReference: {
      type: String,
      default: 'aes128-shared-v1'
    }
  },

  metadata: {
    source: {
      type: String,
      default: 'webapp'
    },
    ipAddress: {
      type: String,
      trim: true
    },
    userAgent: {
      type: String,
      trim: true
    }
  }
}, {
  timestamps: true
});

commandSchema.index({ submittedByAddress: 1, nonce: 1 }, { unique: true });
commandSchema.index({ lockDevice: 1 });
commandSchema.index({ lockAddress: 1 });
commandSchema.index({ submittedBy: 1 });
commandSchema.index({ submittedAt: -1 });
commandSchema.index({ expiresAt: 1 });
commandSchema.index({ status: 1 });
commandSchema.index({ processingStatus: 1 });
commandSchema.index({ blockchainCommandId: 1 });
commandSchema.index({ blockchainTxHash: 1 });
commandSchema.index({ onChainExecutionTxHash: 1 });
commandSchema.index({ createdAt: -1 });

commandSchema.methods.toProfileJSON = function() {
  return {
    id: this._id,
    lockDevice: this.lockDevice,
    lockAddress: this.lockAddress,
    submittedBy: this.submittedBy,
    submittedByAddress: this.submittedByAddress,
    commandType: this.commandType,

    rawPayload: this.rawPayload,

    nonce: this.nonce,
    expiresAt: this.expiresAt,
    submittedAt: this.submittedAt,
    status: this.status,
    executionResult: this.executionResult,
    executedAt: this.executedAt,
    executedByLockAddress: this.executedByLockAddress,

    blockchainCommandId: this.blockchainCommandId,
    blockchainTxHash: this.blockchainTxHash,
    blockNumber: this.blockNumber,
    blockTimestamp: this.blockTimestamp,

    executionSyncedOnChain: this.executionSyncedOnChain,
    onChainExecutionTxHash: this.onChainExecutionTxHash,
    onChainExecutionBlockNumber: this.onChainExecutionBlockNumber,
    onChainExecutionBlockTimestamp: this.onChainExecutionBlockTimestamp,

    processingStatus: this.processingStatus,
    processingError: this.processingError,

    encryption: this.encryption,

    // Explicit debug visibility for encrypted result
    cryptoDebug: {
      encryptedPayload: this.encryptedPayload,
      encryptedSessionKey: this.encryptedSessionKey,
      iv: this.iv,
      authTag: this.authTag
    },

    metadata: this.metadata,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

commandSchema.methods.toExecutionJSON = function() {
  return {
    id: this._id,
    lockAddress: this.lockAddress,
    submittedByAddress: this.submittedByAddress,
    commandType: this.commandType,
    encryptedPayload: this.encryptedPayload,
    encryptedSessionKey: this.encryptedSessionKey,
    iv: this.iv,
    authTag: this.authTag,
    nonce: this.nonce,
    payloadHash: this.payloadHash,
    expiresAt: this.expiresAt,
    submittedAt: this.submittedAt,
    status: this.status,
    blockchainCommandId: this.blockchainCommandId,
    blockchainTxHash: this.blockchainTxHash,
    encryption: this.encryption
  };
};

commandSchema.methods.markExecuted = function(lockAddress, resultMessage = 'Command executed successfully') {
  this.status = 'executed';
  this.executedAt = new Date();
  this.executedByLockAddress = lockAddress;
  this.executionResult = resultMessage;
  return this.save();
};

commandSchema.methods.markFailed = function(lockAddress, resultMessage = 'Command execution failed') {
  this.status = 'failed';
  this.executedAt = new Date();
  this.executedByLockAddress = lockAddress;
  this.executionResult = resultMessage;
  return this.save();
};

commandSchema.methods.markExpired = function(resultMessage = 'Command expired before execution') {
  this.status = 'expired';
  this.executedAt = new Date();
  this.executionResult = resultMessage;
  return this.save();
};

commandSchema.methods.markCancelled = function(resultMessage = 'Command cancelled by sender') {
  this.status = 'cancelled';
  this.executedAt = new Date();
  this.executionResult = resultMessage;
  return this.save();
};

commandSchema.statics.getHistoryByLock = async function(lockAddress, page = 1, limit = 20) {
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    this.find({ lockAddress })
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('lockDevice', 'name lockId walletAddress')
      .populate('submittedBy', 'email role profile'),
    this.countDocuments({ lockAddress })
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

commandSchema.statics.getPendingByLock = async function(lockAddress) {
  return this.find({
    lockAddress,
    status: 'pending',
    processingStatus: 'processed',
    blockchainCommandId: { $ne: null },
    expiresAt: { $gt: new Date() }
  })
    .sort({ submittedAt: 1 })
    .populate('submittedBy', 'email role profile')
    .populate('lockDevice', 'name lockId walletAddress');
};

module.exports = mongoose.model('Command', commandSchema);