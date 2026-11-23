const Command = require('../models/Command');
const LockDevice = require('../models/LockDevice');
const logger = require('../utils/logger');

class PendingCommandExpiryService {
  constructor() {
    this.interval = null;
    this.isRunning = false;

    this.enabled =
      String(process.env.PENDING_COMMAND_EXPIRY_ENABLED || 'true').toLowerCase() !== 'false';

    this.intervalMs = Number(process.env.PENDING_COMMAND_EXPIRY_INTERVAL_MS || 10000);

    if (!Number.isFinite(this.intervalMs) || this.intervalMs < 1000) {
      this.intervalMs = 10000;
    }
  }

  async expirePendingCommands() {
    const now = new Date();

    const expiredCommands = await Command.find({
      status: 'pending',
      expiresAt: { $lte: now }
    }).select('_id lockDevice lockAddress commandType expiresAt status');

    if (expiredCommands.length === 0) {
      return {
        expiredCount: 0,
        lockDeviceIds: []
      };
    }

    const commandIds = expiredCommands.map((command) => command._id);

    const lockDeviceIds = [
      ...new Set(
        expiredCommands
          .map((command) => command.lockDevice)
          .filter(Boolean)
          .map((id) => id.toString())
      )
    ];

    const updateResult = await Command.updateMany(
      {
        _id: { $in: commandIds },
        status: 'pending',
        expiresAt: { $lte: now }
      },
      {
        $set: {
          status: 'expired',
          executedAt: now,
          executionResult: 'Command expired before execution',
          processingError: 'Command exceeded expiresAt while still pending',
          updatedAt: now
        }
      }
    );

    if (lockDeviceIds.length > 0) {
      await LockDevice.updateMany(
        { _id: { $in: lockDeviceIds } },
        {
          $set: {
            lastCommandAt: now,
            lastCommandStatus: 'expired',
            updatedAt: now
          }
        }
      );
    }

    logger.info(
      `Pending command expiry service marked ${updateResult.modifiedCount} command(s) as expired`
    );

    return {
      expiredCount: updateResult.modifiedCount,
      lockDeviceIds
    };
  }

  async start() {
    if (!this.enabled) {
      logger.info('Pending command expiry service disabled');
      return;
    }

    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    logger.info(
      `Pending command expiry service started with interval ${this.intervalMs} ms`
    );

    try {
      await this.expirePendingCommands();
    } catch (error) {
      logger.error('Initial pending command expiry check failed:', error);
    }

    this.interval = setInterval(async () => {
      try {
        await this.expirePendingCommands();
      } catch (error) {
        logger.error('Pending command expiry check failed:', error);
      }
    }, this.intervalMs);
  }

  async stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.isRunning = false;
    logger.info('Pending command expiry service stopped');
  }
}

let pendingCommandExpiryServiceInstance = null;

const getPendingCommandExpiryService = () => {
  if (!pendingCommandExpiryServiceInstance) {
    pendingCommandExpiryServiceInstance = new PendingCommandExpiryService();
  }

  return pendingCommandExpiryServiceInstance;
};

module.exports = {
  PendingCommandExpiryService,
  getPendingCommandExpiryService
};