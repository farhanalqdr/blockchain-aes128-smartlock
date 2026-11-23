const crypto = require('crypto');
const LockDevice = require('../models/LockDevice');
const logger = require('../utils/logger');
const { getBlockchainService } = require('../services/blockchainService');

function normalizeString(value) {
  if (value === null || typeof value === 'undefined') return '';
  return String(value).trim();
}

function buildCompatibilityFingerprint({ walletAddress, lockId, name }) {
  const raw = [
    normalizeString(walletAddress).toLowerCase(),
    normalizeString(lockId),
    normalizeString(name),
  ].join('|');

  return crypto.createHash('sha256').update(raw).digest('hex');
}

class LockController {
  static async registerLock(req, res) {
    try {
      const name = normalizeString(req.body.name);
      const lockId = normalizeString(req.body.lockId);
      const walletAddress = normalizeString(req.body.walletAddress);

      if (!name || !lockId || !walletAddress) {
        return res.status(400).json({
          error: 'name, lockId, and walletAddress are required',
          code: 'LOCK_FIELDS_REQUIRED'
        });
      }

      const existingByLockId = await LockDevice.findOne({ lockId });
      if (existingByLockId) {
        return res.status(409).json({
          error: 'Lock ID already exists',
          code: 'LOCK_ID_EXISTS'
        });
      }

      const existingByWallet = await LockDevice.findOne({ walletAddress });
      if (existingByWallet) {
        return res.status(409).json({
          error: 'Lock wallet address already exists',
          code: 'LOCK_WALLET_EXISTS'
        });
      }

      const publicKeyFingerprint = buildCompatibilityFingerprint({
        walletAddress,
        lockId,
        name
      });

      const blockchainService = getBlockchainService();

      const blockchainResult = await blockchainService.registerLockOnChain({
        walletAddress,
        name,
        lockId,
        publicKeyFingerprint
      });

      const lockDevice = new LockDevice({
        name,
        lockId,
        walletAddress,
        publicKeyPem: '',
        publicKeyFingerprint,
        owner: req.user?.userId || null,
        isApproved: false,
        isOnline: false,
        status: 'pending',
        blockchainTxHash: blockchainResult.transactionHash,
        location: {
          building: '',
          floor: '',
          room: '',
          address: ''
        },
        metadata: {
          manufacturer: '',
          model: '',
          firmwareVersion: '',
          serialNumber: '',
          notes: ''
        },
        registeredAt: new Date()
      });

      await lockDevice.save();

      logger.info(`Lock registered on-chain and in DB: ${lockId} (${walletAddress})`);

      res.status(201).json({
        success: true,
        message: 'Lock registered successfully on blockchain and database',
        lock: lockDevice.toProfileJSON(),
        blockchain: blockchainResult
      });
    } catch (error) {
      logger.error('Register lock error:', error);
      res.status(500).json({
        error: 'Failed to register lock',
        code: 'REGISTER_LOCK_ERROR',
        message: error.message
      });
    }
  }

  static async getLocks(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        isApproved,
        isOnline,
        search
      } = req.query;

      const query = {};

      if (status) query.status = status;
      if (typeof isApproved !== 'undefined') query.isApproved = isApproved === 'true';
      if (typeof isOnline !== 'undefined') query.isOnline = isOnline === 'true';

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { lockId: { $regex: search, $options: 'i' } },
          { walletAddress: { $regex: search, $options: 'i' } }
        ];
      }

      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const skip = (pageNum - 1) * limitNum;

      const [locks, total] = await Promise.all([
        LockDevice.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .populate('owner', 'email role profile'),
        LockDevice.countDocuments(query)
      ]);

      res.json({
        success: true,
        data: locks.map(lock => lock.toProfileJSON()),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      logger.error('Get locks error:', error);
      res.status(500).json({
        error: 'Failed to get locks',
        code: 'GET_LOCKS_ERROR',
        message: error.message
      });
    }
  }

  static async getLockById(req, res) {
    try {
      const { lockId } = req.params;

      const lock = await LockDevice.findById(lockId).populate('owner', 'email role profile');
      if (!lock) {
        return res.status(404).json({
          error: 'Lock not found',
          code: 'LOCK_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        data: lock.toProfileJSON()
      });
    } catch (error) {
      logger.error('Get lock by ID error:', error);
      res.status(500).json({
        error: 'Failed to get lock',
        code: 'GET_LOCK_BY_ID_ERROR',
        message: error.message
      });
    }
  }

  static async getLockByAddress(req, res) {
    try {
      const { walletAddress } = req.params;

      const lock = await LockDevice.findOne({ walletAddress }).populate('owner', 'email role profile');
      if (!lock) {
        return res.status(404).json({
          error: 'Lock not found',
          code: 'LOCK_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        data: lock.toProfileJSON()
      });
    } catch (error) {
      logger.error('Get lock by address error:', error);
      res.status(500).json({
        error: 'Failed to get lock by address',
        code: 'GET_LOCK_BY_ADDRESS_ERROR',
        message: error.message
      });
    }
  }

  static async getLockPublicKey(req, res) {
    try {
      const { walletAddress } = req.params;

      const lock = await LockDevice.findOne({ walletAddress });
      if (!lock) {
        return res.status(404).json({
          error: 'Lock not found',
          code: 'LOCK_NOT_FOUND'
        });
      }

      if (!lock.isApproved) {
        return res.status(400).json({
          error: 'Lock is not approved yet',
          code: 'LOCK_NOT_APPROVED'
        });
      }

      res.json({
        success: true,
        data: lock.toEncryptionJSON(),
        note: 'Compatibility endpoint. Current smartlock flow uses AES-only commands.'
      });
    } catch (error) {
      logger.error('Get lock public key error:', error);
      res.status(500).json({
        error: 'Failed to get lock public key',
        code: 'GET_LOCK_PUBLIC_KEY_ERROR',
        message: error.message
      });
    }
  }

  static async approveLock(req, res) {
    try {
      const { walletAddress } = req.params;

      const lock = await LockDevice.findOne({ walletAddress });
      if (!lock) {
        return res.status(404).json({
          error: 'Lock not found',
          code: 'LOCK_NOT_FOUND'
        });
      }

      const blockchainService = getBlockchainService();
      const blockchainResult = await blockchainService.approveLockOnChain(walletAddress);

      await lock.approve(blockchainResult.transactionHash);

      res.json({
        success: true,
        message: 'Lock approved successfully on blockchain and database',
        data: lock.toProfileJSON(),
        blockchain: blockchainResult
      });
    } catch (error) {
      logger.error('Approve lock error:', error);
      res.status(500).json({
        error: 'Failed to approve lock',
        code: 'APPROVE_LOCK_ERROR',
        message: error.message
      });
    }
  }

  static async rejectLock(req, res) {
    try {
      const { walletAddress } = req.params;

      const lock = await LockDevice.findOne({ walletAddress });
      if (!lock) {
        return res.status(404).json({
          error: 'Lock not found',
          code: 'LOCK_NOT_FOUND'
        });
      }

      const blockchainService = getBlockchainService();
      const blockchainResult = await blockchainService.rejectLockOnChain(walletAddress);

      await lock.reject();
      lock.blockchainTxHash = blockchainResult.transactionHash;
      await lock.save();

      res.json({
        success: true,
        message: 'Lock rejected successfully on blockchain and database',
        data: lock.toProfileJSON(),
        blockchain: blockchainResult
      });
    } catch (error) {
      logger.error('Reject lock error:', error);
      res.status(500).json({
        error: 'Failed to reject lock',
        code: 'REJECT_LOCK_ERROR',
        message: error.message
      });
    }
  }

  static async heartbeat(req, res) {
    try {
      const { walletAddress } = req.params;
      const { isOnline = true } = req.body;

      const lock = await LockDevice.findOne({ walletAddress });
      if (!lock) {
        return res.status(404).json({
          error: 'Lock not found',
          code: 'LOCK_NOT_FOUND'
        });
      }

      await lock.updateHeartbeat(Boolean(isOnline));

      res.json({
        success: true,
        message: 'Heartbeat recorded successfully',
        data: lock.toProfileJSON()
      });
    } catch (error) {
      logger.error('Lock heartbeat error:', error);
      res.status(500).json({
        error: 'Failed to record lock heartbeat',
        code: 'LOCK_HEARTBEAT_ERROR',
        message: error.message
      });
    }
  }
}

module.exports = LockController;