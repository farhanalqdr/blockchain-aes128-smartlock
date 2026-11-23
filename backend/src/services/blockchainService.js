const { ethers } = require('ethers');
const contractConfig = require('../config/contract');
const logger = require('../utils/logger');

class BlockchainService {
  constructor() {
    this.provider = null;
    this.contract = null;
    this.signer = null;
    this.isListening = false;
    this.initializeConnection();
  }

  sanitizePrivateKey(privateKey) {
    if (!privateKey) return null;
    return privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  }

  sanitizeString(value) {
    if (value === null || typeof value === 'undefined') return '';
    return String(value);
  }

  initializeConnection() {
    try {
      if (!process.env.RPC_URL) {
        logger.warn('RPC_URL is missing. Blockchain connection is disabled.');
        return;
      }

      if (!contractConfig.address) {
        logger.warn('CONTRACT_ADDRESS is missing. Blockchain connection is disabled.');
        return;
      }

      this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
      this.contract = new ethers.Contract(
        contractConfig.address,
        contractConfig.abi,
        this.provider
      );

      const normalizedPrivateKey = this.sanitizePrivateKey(process.env.PRIVATE_KEY);
      if (normalizedPrivateKey) {
        this.signer = new ethers.Wallet(normalizedPrivateKey, this.provider);
        this.contract = this.contract.connect(this.signer);
      }

      logger.info('Blockchain connection initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize blockchain connection:', error);
      throw new Error('Blockchain connection failed');
    }
  }

  ensureReadableContract() {
    if (!this.provider || !this.contract) {
      throw new Error('Blockchain provider or contract is not initialized');
    }
  }

  ensureWritableContract() {
    this.ensureReadableContract();

    if (!this.signer) {
      throw new Error('No signer available. PRIVATE_KEY must be configured for blockchain write operations.');
    }
  }

  base64ToHex(base64Value) {
    const buffer = Buffer.from(base64Value, 'base64');
    return `0x${buffer.toString('hex')}`;
  }

  nonceToBytes32(nonceHex) {
    const clean = String(nonceHex || '').replace(/^0x/, '');
    if (clean.length !== 64) {
      throw new Error(`Nonce must be 32 bytes (64 hex chars). Current length: ${clean.length}`);
    }
    return `0x${clean}`;
  }

  async checkConnection() {
    try {
      this.ensureReadableContract();

      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();
      const code = await this.provider.getCode(contractConfig.address);

      if (!code || code === '0x') {
        return {
          connected: false,
          error: `No contract bytecode found at ${contractConfig.address}`
        };
      }

      const signerAddress = this.signer ? await this.signer.getAddress() : null;

      return {
        connected: true,
        network: {
          name: network.name,
          chainId: Number(network.chainId)
        },
        blockNumber,
        contractAddress: contractConfig.address,
        signerAddress
      };
    } catch (error) {
      logger.error('Blockchain connection check failed:', error);
      return {
        connected: false,
        error: error.message
      };
    }
  }

  async getBlockNumber() {
    try {
      this.ensureReadableContract();
      return await this.provider.getBlockNumber();
    } catch (error) {
      logger.error('Failed to get block number:', error);
      throw new Error('Failed to get block number');
    }
  }

  async getSignerAddress() {
    if (!this.signer) return null;
    return this.signer.getAddress();
  }

  async registerLockOnChain(lockData) {
    try {
      this.ensureWritableContract();

      if (typeof this.contract.registerLock !== 'function') {
        throw new Error('registerLock function is not available in current contract ABI');
      }

      const safeWalletAddress = this.sanitizeString(lockData.walletAddress);
      const safeName = this.sanitizeString(lockData.name);
      const safeLockId = this.sanitizeString(lockData.lockId);
      const safePublicKeyFingerprint = this.sanitizeString(lockData.publicKeyFingerprint);

      const tx = await this.contract.registerLock(
        safeWalletAddress,
        safeName,
        safeLockId,
        safePublicKeyFingerprint
      );

      logger.info(`Lock registration transaction sent: ${tx.hash}`);

      const receipt = await tx.wait();
      logger.info(`Lock registration confirmed in block: ${receipt.blockNumber}`);

      return {
        success: true,
        transactionHash: tx.hash,
        blockNumber: Number(receipt.blockNumber),
        signerAddress: await this.getSignerAddress()
      };
    } catch (error) {
      logger.error('Blockchain lock registration failed:', error);
      throw new Error(`Lock registration failed: ${error.message}`);
    }
  }

  async approveLockOnChain(lockAddress) {
    try {
      this.ensureWritableContract();

      if (typeof this.contract.approveLock !== 'function') {
        throw new Error('approveLock function is not available in current contract ABI');
      }

      const tx = await this.contract.approveLock(lockAddress);
      logger.info(`Lock approval transaction sent: ${tx.hash}`);

      const receipt = await tx.wait();
      logger.info(`Lock approval confirmed in block: ${receipt.blockNumber}`);

      return {
        success: true,
        transactionHash: tx.hash,
        blockNumber: Number(receipt.blockNumber),
        signerAddress: await this.getSignerAddress()
      };
    } catch (error) {
      logger.error('Blockchain lock approval failed:', error);
      throw new Error(`Lock approval failed: ${error.message}`);
    }
  }

  async rejectLockOnChain(lockAddress) {
    try {
      this.ensureWritableContract();

      if (typeof this.contract.rejectLock !== 'function') {
        throw new Error('rejectLock function is not available in current contract ABI');
      }

      const tx = await this.contract.rejectLock(lockAddress);
      logger.info(`Lock rejection transaction sent: ${tx.hash}`);

      const receipt = await tx.wait();
      logger.info(`Lock rejection confirmed in block: ${receipt.blockNumber}`);

      return {
        success: true,
        transactionHash: tx.hash,
        blockNumber: Number(receipt.blockNumber),
        signerAddress: await this.getSignerAddress()
      };
    } catch (error) {
      logger.error('Blockchain lock rejection failed:', error);
      throw new Error(`Lock rejection failed: ${error.message}`);
    }
  }

  async submitEncryptedCommandOnChain(command) {
    try {
      this.ensureWritableContract();

      if (typeof this.contract.submitEncryptedCommand !== 'function') {
        throw new Error('submitEncryptedCommand function is not available in current contract ABI');
      }

      const expiresAtUnix = Math.floor(new Date(command.expiresAt).getTime() / 1000);

      const tx = await this.contract.submitEncryptedCommand(
        command.lockAddress,
        this.base64ToHex(command.encryptedPayload),
        this.base64ToHex(command.encryptedSessionKey),
        this.base64ToHex(command.iv),
        this.base64ToHex(command.authTag),
        expiresAtUnix,
        this.nonceToBytes32(command.nonce)
      );

      logger.info(`Encrypted command transaction sent: ${tx.hash}`);

      const receipt = await tx.wait();
      logger.info(`Encrypted command confirmed in block: ${receipt.blockNumber}`);

      let blockchainCommandId = null;

      for (const log of receipt.logs) {
        try {
          const parsed = this.contract.interface.parseLog({
            topics: log.topics,
            data: log.data
          });

          if (parsed && parsed.name === 'CommandSubmitted') {
            blockchainCommandId = Number(parsed.args.commandId);
            break;
          }
        } catch (_) {
          // ignore logs that do not belong to this contract interface
        }
      }

      const block = await this.provider.getBlock(receipt.blockNumber);

      return {
        success: true,
        transactionHash: tx.hash,
        blockNumber: Number(receipt.blockNumber),
        blockTimestamp: block ? new Date(Number(block.timestamp) * 1000) : null,
        blockchainCommandId,
        signerAddress: await this.getSignerAddress()
      };
    } catch (error) {
      logger.error('Blockchain encrypted command submission failed:', error);
      throw new Error(`Encrypted command submission failed: ${error.message}`);
    }
  }

  async startEventListener() {
    logger.info('Blockchain event listener remains disabled for HTTP RPC / migration phase.');
    return;
  }

  async stopEventListener() {
    try {
      if (this.contract && this.isListening) {
        this.contract.removeAllListeners();
      }
      this.isListening = false;
      logger.info('Blockchain event listener stopped');
    } catch (error) {
      logger.warn('Failed to stop blockchain event listener cleanly:', error.message);
    }
  }
}

let blockchainServiceInstance = null;

const getBlockchainService = () => {
  if (!blockchainServiceInstance) {
    blockchainServiceInstance = new BlockchainService();
  }
  return blockchainServiceInstance;
};

module.exports = {
  BlockchainService,
  getBlockchainService
};