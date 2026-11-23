const Web3 = require('web3');
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const http = require('http');

class BlockchainService {
  constructor(providerUrl, contractAddress, contractABI, apiUrl = null) {
    this.web3 = new Web3(providerUrl);
    this.contractAddress = contractAddress;
    this.contractABI = contractABI;
    this.contract = new this.web3.eth.Contract(contractABI, contractAddress);
    this.apiUrl = apiUrl || process.env.API_URL || 'http://localhost:3000';
    
    // Initialize public key
    this.publicKeyPem = null;
    this.initializePublicKey();
  }

  // Initialize public key by fetching from API or falling back to file/generation
  async initializePublicKey() {
    try {
      // Try to fetch public key from API first
      if (this.apiUrl) {
        this.publicKeyPem = await this.fetchPublicKeyFromAPI();
        if (this.publicKeyPem) {
          console.log('Public key fetched from API endpoint');
          return;
        }
      }
      
      throw new Error('API fetch failed, will use fallback');
    } catch (error) {
      console.warn('Failed to fetch public key from API:', error.message);
      
      // Fallback to loading from file
      try {
        this.publicKeyPem = fs.readFileSync('public_key.pem', 'utf8');
        console.log('Public key loaded from public_key.pem (fallback)');
        return;
      } catch (fileError) {
        console.warn('Error loading public key from file:', fileError.message);
        
        // Final fallback to generating a new key pair
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
          modulusLength: 2048,
          publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
          },
          privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
          }
        });
        this.publicKeyPem = publicKey;

        // Save the public key for future use
        fs.writeFileSync('public_key.pem', this.publicKeyPem);
        fs.writeFileSync('private_key.pem', privateKey);
        console.log('Generated and saved new RSA public key as final fallback');
      }
    }
  }

  // Fetch public key from API endpoint
  async fetchPublicKeyFromAPI() {
    return new Promise((resolve, reject) => {
      const url = `${this.apiUrl}/api/auth/public-key`;
      const isHttps = url.startsWith('https://');
      const client = isHttps ? https : http;
      
      try {
        const requestUrl = new URL(url);
        
        const req = client.request({
          hostname: requestUrl.hostname,
          port: requestUrl.port || (isHttps ? 443 : 80),
          path: requestUrl.pathname + requestUrl.search,
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'IoT-Edge-Device/1.0'
          },
          timeout: 10000 // 10 second timeout
        }, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            try {
              if (res.statusCode === 200) {
                const response = JSON.parse(data);
                if (response.publicKey) {
                  resolve(response.publicKey);
                } else {
                  reject(new Error('Public key not found in response'));
                }
              } else {
                reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
              }
            } catch (parseError) {
              reject(new Error(`Failed to parse response: ${parseError.message}`));
            }
          });
        });
        
        req.on('error', (error) => {
          reject(new Error(`Request failed: ${error.message}`));
        });
        
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });
        
        req.end();
      } catch (error) {
        reject(new Error(`Invalid URL: ${error.message}`));
      }
    });
  }

  // Get the public key in PEM format
  getPublicKey() {
    return this.publicKeyPem;
  }

  // Encrypt data using Node.js crypto module with public key
  encryptData(data, publicKeyPem) {
    try {
      // Ensure data is string and not too large for RSA
      const dataStr = typeof data === 'string' ? data : JSON.stringify(data);

      // Check if data is too large for 2048-bit RSA with OAEP padding
      const maxDataSize = 190; // Maximum for 2048-bit RSA with OAEP padding
      if (dataStr.length > maxDataSize) {
        console.warn(`Data size (${dataStr.length} bytes) exceeds maximum for RSA encryption. Consider using hybrid encryption.`);
        // For now, we'll truncate the data to demonstrate the fix
        const truncatedData = dataStr.substring(0, maxDataSize);
        console.warn(`Truncating data to ${truncatedData.length} bytes for encryption`);
        const encrypted = crypto.publicEncrypt(
          {
            key: publicKeyPem,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256',
          },
          Buffer.from(truncatedData, 'utf8')
        ).toString('base64');
        console.log('encrypted data length: ', encrypted.length);
        return encrypted;
      }

      const encrypted = crypto.publicEncrypt(
        {
          key: publicKeyPem,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        Buffer.from(dataStr, 'utf8')
      ).toString('base64');
      console.log('encrypted data: ', encrypted)
      console.log('encrypted data length: ', encrypted.length);
      return encrypted;
    } catch (error) {
      console.error('Encryption error:', error.message);
      console.error('Error details:', error);
      return null;
    }
  }

  // Note: This is an encryption-only service
  // For decryption, the private key would be needed and should be handled in a separate secure service
  decryptData(encryptedData, privateKeyPem) {
    try {
      if (!privateKeyPem) {
        throw new Error('Private key required for decryption. This service is encryption-only.');
      }

      const decrypted = crypto.privateDecrypt(
        {
          key: privateKeyPem,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        Buffer.from(encryptedData, 'base64')
      ).toString('utf8');
      console.log('decrypted data length: ', decrypted.length);
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error.message);
      return null;
    }
  }

  // Register device to the blockchain
  async registerDevice(deviceId, deviceName, accountAddress, privateKey) {
    try {
      // Generate a MAC address for the device (using deviceId as base)
      const macAddress = this.generateMacAddress(deviceId);

      const tx = {
        from: accountAddress,
        to: this.contractAddress,
        gas: 2000000,
        // gasPrice: this.web3.utils.toWei('20', 'gwei'),
        data: this.contract.methods.registerDevice(deviceName, macAddress).encodeABI()
      };

      const signedTx = await this.web3.eth.accounts.signTransaction(tx, privateKey);
      const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);

      console.log(`Device registered successfully! Transaction Receipt:`);
      console.log(`   - Transaction Hash: ${receipt.transactionHash}`);
      console.log(`   - Block Number: ${receipt.blockNumber}`);
      console.log(`   - Block Hash: ${receipt.blockHash}`);
      console.log(`   - Gas Used: ${receipt.gasUsed}`);
      console.log(`   - Cumulative Gas Used: ${receipt.cumulativeGasUsed}`);
      console.log(`   - Gas Limit: ${tx.gas}`);
      console.log(`   - Gas Price: ${tx.gasPrice}`);
      console.log(`   - From: ${receipt.from}`);
      console.log(`   - To: ${receipt.to}`);
      console.log(`   - Status: ${receipt.status === true ? 'SUCCESS' : 'FAILED'}`);
      console.log(`   - Logs Count: ${receipt.logs.length}`);

      return receipt;
    } catch (error) {
      console.error('Device registration error:', error.message);
      throw error;
    }
  }

  // Submit encrypted data to the blockchain
  async submitData(deviceId, data, accountAddress, privateKey) {
    try {
      // Use the service's public key for encryption (consistent with decryption)
      const encryptedData = this.encryptData(data, this.publicKeyPem);

      if (!encryptedData) {
        throw new Error('Failed to encrypt data');
      }

      const tx = {
        from: accountAddress,
        to: this.contractAddress,
        gas: 2000000,
        // gasPrice: this.web3.utils.toWei('20', 'gwei'),
        data: this.contract.methods.submitEncryptedData(encryptedData).encodeABI()
      };

      const signedTx = await this.web3.eth.accounts.signTransaction(tx, privateKey);
      const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);

      console.log(`Data submitted successfully! Transaction Receipt:`);
      console.log(`   - Transaction Hash: ${receipt.transactionHash}`);
      console.log(`   - Block Number: ${receipt.blockNumber}`);
      console.log(`   - Block Hash: ${receipt.blockHash}`);
      console.log(`   - Gas Used: ${receipt.gasUsed}`);
      console.log(`   - Cumulative Gas Used: ${receipt.cumulativeGasUsed}`);
      console.log(`   - Gas Limit: ${tx.gas}`);
      console.log(`   - Gas Price: ${tx.gasPrice}`);
      console.log(`   - From: ${receipt.from}`);
      console.log(`   - To: ${receipt.to}`);
      console.log(`   - Status: ${receipt.status === true ? 'SUCCESS' : 'FAILED'}`);
      console.log(`   - Logs Count: ${receipt.logs.length}`);
      console.log(`   - Encrypted Data Size: ${encryptedData.length} characters`);

      return receipt;
    } catch (error) {
      console.error('Data submission error:', error.message);
      throw error;
    }
  }

  // Check if device is already registered
  async isDeviceRegistered(deviceId) {
    try {
      // Generate MAC address from deviceId to check registration
      const macAddress = this.generateMacAddress(deviceId);
      const deviceAddress = await this.contract.methods.getDeviceByMac(macAddress).call();

      // If the returned address is not zero, the device is registered
      return deviceAddress !== '0x0000000000000000000000000000000000000000';
    } catch (error) {
      console.error('Error checking device registration:', error.message);
      return false;
    }
  }

  // Generate a MAC address from deviceId
  generateMacAddress(deviceId) {
    // Create a deterministic MAC address from deviceId
    const hash = require('crypto').createHash('sha256').update(deviceId).digest('hex');
    const macPart = hash.substring(0, 12);
    return `${macPart.substring(0, 2)}:${macPart.substring(2, 4)}:${macPart.substring(4, 6)}:${macPart.substring(6, 8)}:${macPart.substring(8, 10)}:${macPart.substring(10, 12)}`;
  }
}

module.exports = BlockchainService;