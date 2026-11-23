const crypto = require('crypto');
const logger = require('../utils/logger');

class EncryptionService {
  constructor() {
    this.sharedKey = this.resolveSharedKey();
    this.keyId = process.env.AES_KEY_ID || 'aes128-shared-v1';
  }

  resolveSharedKey() {
    // Option 1: HEX key, exactly 32 hex chars = 16 bytes
    const hexKey = process.env.AES_SHARED_KEY_HEX;
    if (hexKey) {
      const clean = hexKey.trim().replace(/^0x/, '');
      if (!/^[0-9a-fA-F]{32}$/.test(clean)) {
        throw new Error('AES_SHARED_KEY_HEX must be exactly 32 hex characters (16 bytes)');
      }
      return Buffer.from(clean, 'hex');
    }

    // Option 2: plain text key, exactly 16 bytes
    const textKey = process.env.AES_SHARED_KEY;
    if (!textKey) {
      throw new Error(
        'AES shared key is missing. Set AES_SHARED_KEY (16 chars) or AES_SHARED_KEY_HEX (32 hex chars)'
      );
    }

    const keyBuffer = Buffer.from(textKey, 'utf8');
    if (keyBuffer.length !== 16) {
      throw new Error('AES_SHARED_KEY must be exactly 16 bytes / 16 ASCII characters');
    }

    return keyBuffer;
  }

  getPublicKey() {
    // AES-only mode: there is no public key anymore
    return null;
  }

  getKeyInfo() {
    return {
      mode: 'AES_ONLY',
      payloadEncryption: 'AES-128-GCM',
      keyType: 'Symmetric Shared Key',
      keyId: this.keyId
    };
  }

  encryptWithAesGcm(data, keyBuffer = this.sharedKey) {
    try {
      const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
      const ivBuffer = crypto.randomBytes(12);

      const cipher = crypto.createCipheriv('aes-128-gcm', keyBuffer, ivBuffer);

      const encryptedBuffer = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final()
      ]);

      const authTagBuffer = cipher.getAuthTag();

      return {
        encryptedPayload: encryptedBuffer.toString('base64'),
        iv: ivBuffer.toString('base64'),
        authTag: authTagBuffer.toString('base64')
      };
    } catch (error) {
      logger.error('AES-128-GCM encryption failed:', error);
      throw new Error('AES encryption failed');
    }
  }

  decryptWithAesGcm(encryptedPayload, iv, authTag, keyBuffer = this.sharedKey) {
    try {
      const ivBuffer = Buffer.from(iv, 'base64');
      const authTagBuffer = Buffer.from(authTag, 'base64');
      const encryptedBuffer = Buffer.from(encryptedPayload, 'base64');

      const decipher = crypto.createDecipheriv('aes-128-gcm', keyBuffer, ivBuffer);
      decipher.setAuthTag(authTagBuffer);

      const decryptedBuffer = Buffer.concat([
        decipher.update(encryptedBuffer),
        decipher.final()
      ]);

      const decryptedText = decryptedBuffer.toString('utf8');

      try {
        return JSON.parse(decryptedText);
      } catch {
        return decryptedText;
      }
    } catch (error) {
      logger.error('AES-128-GCM decryption failed:', error);
      throw new Error('AES decryption failed');
    }
  }

  buildEncryptedCommandPackage({
    commandType,
    lockAddress,
    submittedByAddress,
    expiresInSeconds = 60
  }) {
    try {
      const allowedCommands = ['LOCK', 'UNLOCK'];
      if (!allowedCommands.includes(commandType)) {
        throw new Error('Invalid commandType. Only LOCK or UNLOCK is allowed.');
      }

      const issuedAt = Math.floor(Date.now() / 1000);
      const expiresAt = issuedAt + Number(expiresInSeconds || 60);
      const nonce = crypto.randomBytes(32).toString('hex');

      const rawPayload = {
        command: commandType,
        targetLock: lockAddress,
        issuedBy: submittedByAddress,
        nonce,
        issuedAt,
        expiresAt
      };

      const aesResult = this.encryptWithAesGcm(rawPayload, this.sharedKey);

      // Compatibility field only, because current contract/model still expects encryptedSessionKey
      const encryptedSessionKey = Buffer.from(this.keyId, 'utf8').toString('base64');

      const payloadHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(rawPayload))
        .digest('hex');

      const result = {
        rawPayload,
        encryptedPayload: aesResult.encryptedPayload,
        encryptedSessionKey,
        iv: aesResult.iv,
        authTag: aesResult.authTag,
        nonce,
        expiresAt,
        payloadHash,
        encryption: {
          payloadAlgorithm: 'AES-128-GCM',
          keyMode: 'SYMMETRIC_SHARED_KEY',
          keyReference: this.keyId
        }
      };

      if (String(process.env.CRYPTO_DEBUG_LOG).toLowerCase() === 'true') {
        console.log('\n===== CRYPTO DEBUG (BACKEND) =====');
        console.log('RAW PAYLOAD:', rawPayload);
        console.log('ENCRYPTED PAYLOAD:', result.encryptedPayload);
        console.log('IV:', result.iv);
        console.log('AUTH TAG:', result.authTag);
        console.log('KEY REFERENCE:', this.keyId);
        console.log('==================================\n');
      }

      return result;
    } catch (error) {
      logger.error('Failed to build encrypted command package:', error);
      throw new Error(`Command package generation failed: ${error.message}`);
    }
  }

  decryptCommandPackage({ encryptedPayload, iv, authTag }) {
    try {
      return this.decryptWithAesGcm(
        encryptedPayload,
        iv,
        authTag,
        this.sharedKey
      );
    } catch (error) {
      logger.error('Failed to decrypt command package:', error);
      throw new Error(`Command package decryption failed: ${error.message}`);
    }
  }
}

let encryptionServiceInstance = null;

const getEncryptionService = () => {
  if (!encryptionServiceInstance) {
    encryptionServiceInstance = new EncryptionService();
  }
  return encryptionServiceInstance;
};

module.exports = {
  EncryptionService,
  getEncryptionService
};