const crypto = require('crypto');
const Command = require('../models/Command');
const LockDevice = require('../models/LockDevice');
const logger = require('../utils/logger');
const { getEncryptionService } = require('../services/encryptionService');
const { getBlockchainService } = require('../services/blockchainService');

class CommandController {
  static resolveSubmittedByAddress(req) {
    return req.user?.walletAddress || req.body.submittedByAddress || '';
  }

  static async persistOnChain(command) {
    const blockchainService = getBlockchainService();
    return blockchainService.submitEncryptedCommandOnChain(command);
  }

  static async submitCommand(req, res) {
    try {
      const {
        lockAddress,
        commandType,
        encryptedPayload,
        encryptedSessionKey,
        iv,
        authTag,
        nonce,
        expiresAt,
        rawPayload = null,
        metadata = {}
      } = req.body;

      if (!lockAddress) {
        return res.status(400).json({
          error: 'lockAddress is required',
          code: 'LOCK_ADDRESS_REQUIRED'
        });
      }

      if (!commandType || !['LOCK', 'UNLOCK'].includes(commandType)) {
        return res.status(400).json({
          error: 'commandType must be LOCK or UNLOCK',
          code: 'INVALID_COMMAND_TYPE'
        });
      }

      if (!encryptedPayload || !encryptedSessionKey || !iv || !authTag || !nonce || !expiresAt) {
        return res.status(400).json({
          error: 'encryptedPayload, encryptedSessionKey, iv, authTag, nonce, and expiresAt are required',
          code: 'COMMAND_FIELDS_REQUIRED'
        });
      }

      const expiryDate = new Date(expiresAt);
      if (Number.isNaN(expiryDate.getTime())) {
        return res.status(400).json({
          error: 'expiresAt must be a valid datetime',
          code: 'INVALID_EXPIRY_DATE'
        });
      }

      if (expiryDate <= new Date()) {
        return res.status(400).json({
          error: 'expiresAt must be in the future',
          code: 'EXPIRY_MUST_BE_FUTURE'
        });
      }

      const lockDevice = await LockDevice.findOne({ walletAddress: lockAddress });
      if (!lockDevice) {
        return res.status(404).json({
          error: 'Lock device not found',
          code: 'LOCK_NOT_FOUND'
        });
      }

      if (!lockDevice.isApproved) {
        return res.status(400).json({
          error: 'Lock device is not approved yet',
          code: 'LOCK_NOT_APPROVED'
        });
      }

      const submittedByAddress = CommandController.resolveSubmittedByAddress(req);
      if (!submittedByAddress) {
        return res.status(400).json({
          error: 'submittedByAddress is required for now because user wallet is not yet linked in backend auth model',
          code: 'SUBMITTED_BY_ADDRESS_REQUIRED'
        });
      }

      const payloadHash = crypto
        .createHash('sha256')
        .update(String(encryptedPayload))
        .digest('hex');

      const command = new Command({
        lockDevice: lockDevice._id,
        lockAddress,
        submittedBy: req.user?.userId || null,
        submittedByAddress,
        commandType,
        rawPayload,
        encryptedPayload,
        encryptedSessionKey,
        iv,
        authTag,
        nonce,
        payloadHash,
        expiresAt: expiryDate,
        submittedAt: new Date(),
        status: 'pending',
        processingStatus: 'pending',
        encryption: {
          payloadAlgorithm: 'AES-128-GCM',
          keyMode: 'SYMMETRIC_SHARED_KEY',
          keyReference: process.env.AES_KEY_ID || 'aes128-shared-v1'
        },
        metadata: {
          source: metadata.source || 'webapp',
          ipAddress: req.ip || metadata.ipAddress || '',
          userAgent: req.headers['user-agent'] || metadata.userAgent || ''
        }
      });

      await command.save();
      await lockDevice.updateLastCommand('pending');

      try {
        const blockchainResult = await CommandController.persistOnChain(command);

        command.blockchainCommandId = blockchainResult.blockchainCommandId || null;
        command.blockchainTxHash = blockchainResult.transactionHash;
        command.blockNumber = blockchainResult.blockNumber;
        command.blockTimestamp = blockchainResult.blockTimestamp;
        command.processingStatus = 'processed';
        command.processingError = '';
        await command.save();

        logger.info(`Encrypted command stored and submitted on-chain: ${command.commandType} for ${lockAddress}`);

        return res.status(201).json({
          success: true,
          message: 'Encrypted command stored and submitted to blockchain successfully',
          command: command.toProfileJSON(),
          blockchain: blockchainResult,
          relayNote: {
            onChainSender: blockchainResult.signerAddress,
            requestedByAddress: submittedByAddress
          }
        });
      } catch (chainError) {
        command.processingStatus = 'error';
        command.processingError = chainError.message;
        await command.save();

        logger.error('Blockchain submission failed after DB save:', chainError);

        return res.status(500).json({
          error: 'Command was saved in database but failed to submit on-chain',
          code: 'BLOCKCHAIN_SUBMIT_ERROR',
          message: chainError.message,
          command: command.toProfileJSON()
        });
      }
    } catch (error) {
      logger.error('Submit command error:', error);

      if (error.code === 11000) {
        return res.status(409).json({
          error: 'Duplicate nonce for this sender',
          code: 'NONCE_ALREADY_USED',
          message: 'Please generate a new nonce before sending another command'
        });
      }

      res.status(500).json({
        error: 'Failed to submit command',
        code: 'SUBMIT_COMMAND_ERROR',
        message: error.message
      });
    }
  }

  static async encryptAndSubmitCommand(req, res) {
    try {
      const {
        lockAddress,
        commandType,
        expiresInSeconds = 60,
        metadata = {}
      } = req.body;

      if (!lockAddress) {
        return res.status(400).json({
          error: 'lockAddress is required',
          code: 'LOCK_ADDRESS_REQUIRED'
        });
      }

      if (!commandType || !['LOCK', 'UNLOCK'].includes(commandType)) {
        return res.status(400).json({
          error: 'commandType must be LOCK or UNLOCK',
          code: 'INVALID_COMMAND_TYPE'
        });
      }

      const submittedByAddress = CommandController.resolveSubmittedByAddress(req);
      if (!submittedByAddress) {
        return res.status(400).json({
          error: 'submittedByAddress is required for now because user wallet is not yet linked in backend auth model',
          code: 'SUBMITTED_BY_ADDRESS_REQUIRED'
        });
      }

      const lockDevice = await LockDevice.findOne({ walletAddress: lockAddress });
      if (!lockDevice) {
        return res.status(404).json({
          error: 'Lock device not found',
          code: 'LOCK_NOT_FOUND'
        });
      }

      if (!lockDevice.isApproved) {
        return res.status(400).json({
          error: 'Lock device is not approved yet',
          code: 'LOCK_NOT_APPROVED'
        });
      }

      const encryptionService = getEncryptionService();

      const encryptedPackage = encryptionService.buildEncryptedCommandPackage({
        commandType,
        lockAddress,
        submittedByAddress,
        expiresInSeconds
      });

      const command = new Command({
        lockDevice: lockDevice._id,
        lockAddress,
        submittedBy: req.user?.userId || null,
        submittedByAddress,
        commandType,
        rawPayload: encryptedPackage.rawPayload,
        encryptedPayload: encryptedPackage.encryptedPayload,
        encryptedSessionKey: encryptedPackage.encryptedSessionKey,
        iv: encryptedPackage.iv,
        authTag: encryptedPackage.authTag,
        nonce: encryptedPackage.nonce,
        payloadHash: encryptedPackage.payloadHash,
        expiresAt: new Date(encryptedPackage.expiresAt * 1000),
        submittedAt: new Date(encryptedPackage.rawPayload.issuedAt * 1000),
        status: 'pending',
        processingStatus: 'pending',
        encryption: encryptedPackage.encryption,
        metadata: {
          source: metadata.source || 'webapp',
          ipAddress: req.ip || metadata.ipAddress || '',
          userAgent: req.headers['user-agent'] || metadata.userAgent || ''
        }
      });

      await command.save();
      await lockDevice.updateLastCommand('pending');

      try {
        const blockchainResult = await CommandController.persistOnChain(command);

        command.blockchainCommandId = blockchainResult.blockchainCommandId || null;
        command.blockchainTxHash = blockchainResult.transactionHash;
        command.blockNumber = blockchainResult.blockNumber;
        command.blockTimestamp = blockchainResult.blockTimestamp;
        command.processingStatus = 'processed';
        command.processingError = '';
        await command.save();

        logger.info(`AES-only encrypted command stored and submitted on-chain: ${command.commandType} for ${lockAddress}`);

        return res.status(201).json({
          success: true,
          message: 'Command encrypted, stored, and submitted to blockchain successfully',
          command: command.toProfileJSON(),
          encryptionSummary: encryptedPackage.encryption,
          blockchain: blockchainResult,
          relayNote: {
            onChainSender: blockchainResult.signerAddress,
            requestedByAddress: submittedByAddress
          }
        });
      } catch (chainError) {
        command.processingStatus = 'error';
        command.processingError = chainError.message;
        await command.save();

        logger.error('Blockchain submission failed after encryption+DB save:', chainError);

        return res.status(500).json({
          error: 'Command was encrypted and saved in database but failed to submit on-chain',
          code: 'BLOCKCHAIN_SUBMIT_ERROR',
          message: chainError.message,
          command: command.toProfileJSON()
        });
      }
    } catch (error) {
      logger.error('Encrypt and submit command error:', error);

      if (error.code === 11000) {
        return res.status(409).json({
          error: 'Duplicate nonce for this sender',
          code: 'NONCE_ALREADY_USED',
          message: 'Please send the request again to generate a new nonce'
        });
      }

      res.status(500).json({
        error: 'Failed to encrypt and submit command',
        code: 'ENCRYPT_AND_SUBMIT_COMMAND_ERROR',
        message: error.message
      });
    }
  }

  static async getAllCommands(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        lockAddress,
        status,
        commandType,
        sort = '-submittedAt'
      } = req.query;

      const query = {};
      if (lockAddress) query.lockAddress = lockAddress;
      if (status) query.status = status;
      if (commandType) query.commandType = commandType;

      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const skip = (pageNum - 1) * limitNum;

      const [commands, total] = await Promise.all([
        Command.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limitNum)
          .populate('lockDevice', 'name lockId walletAddress status isApproved')
          .populate('submittedBy', 'email role profile'),
        Command.countDocuments(query)
      ]);

      res.json({
        success: true,
        data: commands.map((item) => item.toProfileJSON()),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      logger.error('Get all commands error:', error);
      res.status(500).json({
        error: 'Failed to get commands',
        code: 'GET_COMMANDS_ERROR',
        message: error.message
      });
    }
  }

  static async getCommandById(req, res) {
    try {
      const { commandId } = req.params;

      const command = await Command.findById(commandId)
        .populate('lockDevice', 'name lockId walletAddress status isApproved')
        .populate('submittedBy', 'email role profile');

      if (!command) {
        return res.status(404).json({
          error: 'Command not found',
          code: 'COMMAND_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        data: command.toProfileJSON()
      });
    } catch (error) {
      logger.error('Get command by ID error:', error);
      res.status(500).json({
        error: 'Failed to get command',
        code: 'GET_COMMAND_BY_ID_ERROR',
        message: error.message
      });
    }
  }

  static async getCommandHistoryByLock(req, res) {
    try {
      const { lockAddress } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const lockDevice = await LockDevice.findOne({ walletAddress: lockAddress });
      if (!lockDevice) {
        return res.status(404).json({
          error: 'Lock device not found',
          code: 'LOCK_NOT_FOUND'
        });
      }

      const result = await Command.getHistoryByLock(
        lockAddress,
        parseInt(page, 10),
        parseInt(limit, 10)
      );

      res.json({
        success: true,
        lock: lockDevice.toProfileJSON(),
        data: result.data.map((item) => item.toProfileJSON()),
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Get command history by lock error:', error);
      res.status(500).json({
        error: 'Failed to get lock command history',
        code: 'GET_LOCK_COMMAND_HISTORY_ERROR',
        message: error.message
      });
    }
  }

  static async getPendingCommandsByLock(req, res) {
    try {
      const { lockAddress } = req.params;

      const lockDevice = await LockDevice.findOne({ walletAddress: lockAddress });
      if (!lockDevice) {
        return res.status(404).json({
          error: 'Lock device not found',
          code: 'LOCK_NOT_FOUND'
        });
      }

      const pendingCommands = await Command.getPendingByLock(lockAddress);

      res.json({
        success: true,
        lock: lockDevice.toProfileJSON(),
        count: pendingCommands.length,
        data: pendingCommands.map((item) => item.toExecutionJSON()),
        note: 'This route is intended for the smartlock listener / Raspberry side.'
      });
    } catch (error) {
      logger.error('Get pending commands by lock error:', error);
      res.status(500).json({
        error: 'Failed to get pending commands',
        code: 'GET_PENDING_COMMANDS_ERROR',
        message: error.message
      });
    }
  }

  static async reportExecution(req, res) {
    try {
      const { commandId } = req.params;
      const {
        success,
        resultMessage,
        executedByLockAddress,
        executionSyncedOnChain = false,
        onChainExecutionTxHash = null,
        onChainExecutionBlockNumber = null,
        onChainExecutionBlockTimestamp = null
      } = req.body;

      if (!executedByLockAddress) {
        return res.status(400).json({
          error: 'executedByLockAddress is required',
          code: 'EXECUTED_BY_LOCK_REQUIRED'
        });
      }

      const command = await Command.findById(commandId).populate('lockDevice');
      if (!command) {
        return res.status(404).json({
          error: 'Command not found',
          code: 'COMMAND_NOT_FOUND'
        });
      }

      if (command.status !== 'pending') {
        return res.status(400).json({
          error: `Command is already finalized with status ${command.status}`,
          code: 'COMMAND_ALREADY_FINALIZED'
        });
      }

      if (new Date() > new Date(command.expiresAt)) {
        await command.markExpired(resultMessage || 'Command expired before execution');

        if (command.lockDevice) {
          await command.lockDevice.updateLastCommand('expired');
        }

        command.executionSyncedOnChain = Boolean(executionSyncedOnChain);
        command.onChainExecutionTxHash = onChainExecutionTxHash;
        command.onChainExecutionBlockNumber = onChainExecutionBlockNumber;
        command.onChainExecutionBlockTimestamp = onChainExecutionBlockTimestamp
          ? new Date(onChainExecutionBlockTimestamp)
          : null;
        await command.save();

        return res.json({
          success: true,
          message: 'Command marked as expired',
          data: command.toProfileJSON()
        });
      }

      if (success === true) {
        await command.markExecuted(
          executedByLockAddress,
          resultMessage || 'Command executed successfully'
        );

        if (command.lockDevice) {
          await command.lockDevice.updateLastCommand('executed');
        }
      } else {
        await command.markFailed(
          executedByLockAddress,
          resultMessage || 'Command execution failed'
        );

        if (command.lockDevice) {
          await command.lockDevice.updateLastCommand('failed');
        }
      }

      command.executionSyncedOnChain = Boolean(executionSyncedOnChain);
      command.onChainExecutionTxHash = onChainExecutionTxHash;
      command.onChainExecutionBlockNumber = onChainExecutionBlockNumber;
      command.onChainExecutionBlockTimestamp = onChainExecutionBlockTimestamp
        ? new Date(onChainExecutionBlockTimestamp)
        : null;
      await command.save();

      res.json({
        success: true,
        message: 'Command execution result recorded successfully',
        data: command.toProfileJSON(),
        note: executionSyncedOnChain
          ? 'Execution was synced both on-chain and in MongoDB.'
          : 'Execution was recorded in MongoDB, but on-chain sync did not complete.'
      });
    } catch (error) {
      logger.error('Report execution error:', error);
      res.status(500).json({
        error: 'Failed to report command execution',
        code: 'REPORT_EXECUTION_ERROR',
        message: error.message
      });
    }
  }
}

module.exports = CommandController;