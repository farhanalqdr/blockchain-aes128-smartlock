const crypto = require('crypto');
const path = require('path');
const { execFile } = require('child_process');
const EdgeBlockchainClient = require('./blockchainClient');

class LockListener {
  constructor({
    apiUrl,
    lockWalletAddress,
    providerUrl,
    contractAddress,
    devicePrivateKey,
    aesSharedKey,
    aesSharedKeyHex,
    pollIntervalMs,
    heartbeatIntervalMs
  }) {
    this.apiUrl = apiUrl.replace(/\/$/, '');
    this.lockWalletAddress = lockWalletAddress;
    this.providerUrl = providerUrl;
    this.contractAddress = contractAddress;
    this.devicePrivateKey = devicePrivateKey;
    this.aesSharedKey = aesSharedKey;
    this.aesSharedKeyHex = aesSharedKeyHex;
    this.pollIntervalMs = pollIntervalMs;
    this.heartbeatIntervalMs = heartbeatIntervalMs;

    this.sharedKeyBuffer = null;
    this.blockchainClient = null;
    this.pollTimer = null;
    this.heartbeatTimer = null;
    this.isRunning = false;
    this.processingIds = new Set();
  }

  resolveSharedKey() {
    if (this.aesSharedKeyHex) {
      const clean = String(this.aesSharedKeyHex).trim().replace(/^0x/, '');
      if (!/^[0-9a-fA-F]{32}$/.test(clean)) {
        throw new Error('AES_SHARED_KEY_HEX must be exactly 32 hex characters');
      }
      return Buffer.from(clean, 'hex');
    }

    if (!this.aesSharedKey) {
      throw new Error('AES_SHARED_KEY or AES_SHARED_KEY_HEX is required');
    }

    const keyBuffer = Buffer.from(this.aesSharedKey, 'utf8');
    if (keyBuffer.length !== 16) {
      throw new Error('AES_SHARED_KEY must be exactly 16 bytes / 16 ASCII characters');
    }

    return keyBuffer;
  }

  async initBlockchainClient() {
    this.blockchainClient = new EdgeBlockchainClient({
      providerUrl: this.providerUrl,
      contractAddress: this.contractAddress,
      devicePrivateKey: this.devicePrivateKey
    });

    const signerAddress = await this.blockchainClient.getSignerAddress();

    console.log('ON-CHAIN EXECUTION SYNC: ENABLED');
    console.log('EDGE SIGNER ADDRESS:', signerAddress);

    if (signerAddress.toLowerCase() !== this.lockWalletAddress.toLowerCase()) {
      throw new Error(
        `EDGE SIGNER ADDRESS (${signerAddress}) does not match LOCK_WALLET_ADDRESS (${this.lockWalletAddress})`
      );
    }
  }

  async start() {
    if (!this.lockWalletAddress) {
      throw new Error('LOCK_WALLET_ADDRESS is required in .env');
    }

    this.sharedKeyBuffer = this.resolveSharedKey();
    await this.initBlockchainClient();

    this.isRunning = true;

    console.log('======================================');
    console.log('SMARTLOCK LISTENER STARTED');
    console.log('API URL:', this.apiUrl);
    console.log('LOCK ADDRESS:', this.lockWalletAddress);
    console.log('AES MODE:', 'AES-128-GCM (SYMMETRIC SHARED KEY)');
    console.log('CONTRACT ADDRESS:', this.contractAddress);
    console.log('POLL INTERVAL (ms):', this.pollIntervalMs);
    console.log('HEARTBEAT INTERVAL (ms):', this.heartbeatIntervalMs);
    console.log('======================================');

    await this.sendHeartbeat(true);
    await this.pollOnce();

    this.pollTimer = setInterval(() => {
      this.pollOnce().catch((err) => {
        console.error('Polling error:', err.message);
      });
    }, this.pollIntervalMs);

    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat(true).catch((err) => {
        console.error('Heartbeat error:', err.message);
      });
    }, this.heartbeatIntervalMs);
  }

  async stop() {
    this.isRunning = false;

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    try {
      await this.sendHeartbeat(false);
    } catch (error) {
      console.error('Failed to send offline heartbeat:', error.message);
    }
  }

  async sendHeartbeat(isOnline) {
    const response = await fetch(
      `${this.apiUrl}/api/locks/heartbeat/${this.lockWalletAddress}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOnline })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Heartbeat failed');
    }

    console.log(`[HEARTBEAT] isOnline=${isOnline} status=${data?.data?.status || 'unknown'}`);
    return data;
  }

  async fetchPendingCommands() {
    const response = await fetch(
      `${this.apiUrl}/api/commands/pending/${this.lockWalletAddress}`
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Failed to fetch pending commands');
    }

    return data;
  }

  decryptPayload({ encryptedPayload, iv, authTag }) {
    const decipher = crypto.createDecipheriv(
      'aes-128-gcm',
      this.sharedKeyBuffer,
      Buffer.from(iv, 'base64')
    );

    decipher.setAuthTag(Buffer.from(authTag, 'base64'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedPayload, 'base64')),
      decipher.final()
    ]).toString('utf8');

    return JSON.parse(decrypted);
  }

  runRelayAction(action) {
    return new Promise((resolve, reject) => {
      const scriptPath = path.resolve(process.cwd(), 'relay_control.py');

      execFile(
        'python3',
        [scriptPath, action],
        { env: process.env, cwd: process.cwd() },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr || error.message));
            return;
          }

          if (stdout) process.stdout.write(stdout);
          if (stderr) process.stderr.write(stderr);

          resolve();
        }
      );
    });
  }

  async reportExecution(commandId, success, resultMessage, onChain = {}) {
    const response = await fetch(
      `${this.apiUrl}/api/commands/${commandId}/execution`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success,
          resultMessage,
          executedByLockAddress: this.lockWalletAddress,
          executionSyncedOnChain: Boolean(onChain.executionSyncedOnChain),
          onChainExecutionTxHash: onChain.onChainExecutionTxHash || null,
          onChainExecutionBlockNumber: onChain.onChainExecutionBlockNumber || null,
          onChainExecutionBlockTimestamp: onChain.onChainExecutionBlockTimestamp || null
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Failed to report execution');
    }

    return data;
  }

  async syncExecutionOnChain(blockchainCommandId, success, resultMessage) {
    if (!blockchainCommandId) {
      throw new Error('blockchainCommandId is missing');
    }

    const chainResult = await this.blockchainClient.markCommandExecuted(
      blockchainCommandId,
      success,
      resultMessage
    );

    console.log('[ON-CHAIN] markCommandExecuted success:', chainResult.transactionHash);

    return {
      executionSyncedOnChain: true,
      onChainExecutionTxHash: chainResult.transactionHash,
      onChainExecutionBlockNumber: chainResult.blockNumber,
      onChainExecutionBlockTimestamp: chainResult.blockTimestamp
    };
  }

  async executeCommandPayload(payload) {
    const { command, targetLock, issuedBy, nonce, issuedAt, expiresAt } = payload;

    console.log('--------------------------------------');
    console.log('DECRYPTED COMMAND RECEIVED');
    console.log('command     :', command);
    console.log('targetLock  :', targetLock);
    console.log('issuedBy    :', issuedBy);
    console.log('nonce       :', nonce);
    console.log('issuedAt    :', issuedAt);
    console.log('expiresAt   :', expiresAt);
    console.log('--------------------------------------');

    const nowUnix = Math.floor(Date.now() / 1000);

    if (targetLock.toLowerCase() !== this.lockWalletAddress.toLowerCase()) {
      throw new Error('Command targetLock does not match this lock listener');
    }

    if (nowUnix > expiresAt) {
      throw new Error('Command already expired before execution');
    }

    if (!['LOCK', 'UNLOCK'].includes(command)) {
      throw new Error(`Unsupported command: ${command}`);
    }

    if (command === 'LOCK') {
      console.log('[HARDWARE] Lock command -> relay OFF');
      await this.runRelayAction('lock');
    } else {
      console.log('[HARDWARE] Unlock command -> relay pulse');
      await this.runRelayAction('unlock');
    }

    return `${command} executed successfully by Raspberry Pi relay (AES-128 symmetric mode)`;
  }

  async processCommand(command) {
    const commandId = command.id;

    if (this.processingIds.has(commandId)) {
      return;
    }

    this.processingIds.add(commandId);

    try {
      console.log(`\n[PROCESS] Command ID: ${commandId}`);

      const payload = this.decryptPayload(command);
      let resultMessage = await this.executeCommandPayload(payload);

      let onChain = { executionSyncedOnChain: false };

      try {
        onChain = await this.syncExecutionOnChain(
          command.blockchainCommandId,
          true,
          resultMessage
        );
      } catch (chainError) {
        console.error('[ON-CHAIN] Success sync failed:', chainError.message);
        resultMessage = `${resultMessage} | On-chain sync failed: ${chainError.message}`;
      }

      const report = await this.reportExecution(commandId, true, resultMessage, onChain);
      console.log('[SUCCESS] Execution reported:', report.message);
    } catch (error) {
      console.error(`[FAILED] Command ${commandId}:`, error.message);

      let failureMessage = error.message;
      let onChain = { executionSyncedOnChain: false };

      try {
        onChain = await this.syncExecutionOnChain(
          command.blockchainCommandId,
          false,
          failureMessage
        );
      } catch (chainError) {
        console.error('[ON-CHAIN] Failure sync failed:', chainError.message);
        failureMessage = `${failureMessage} | On-chain failure sync failed: ${chainError.message}`;
      }

      try {
        await this.reportExecution(commandId, false, failureMessage, onChain);
      } catch (reportError) {
        console.error(`[FAILED] Reporting failure for ${commandId}:`, reportError.message);
      }
    } finally {
      this.processingIds.delete(commandId);
    }
  }

  async pollOnce() {
    if (!this.isRunning) return;

    const result = await this.fetchPendingCommands();
    const commands = Array.isArray(result.data) ? result.data : [];

    console.log(`[POLL] Pending commands found: ${commands.length}`);

    for (const command of commands) {
      await this.processCommand(command);
    }
  }
}

module.exports = LockListener;