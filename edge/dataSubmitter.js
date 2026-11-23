const BlockchainService = require('./blockchainService');

class DataSubmitter {
  constructor(blockchainService, deviceId, accountAddress, privateKey) {
    this.blockchainService = blockchainService;
    this.deviceId = deviceId;
    this.accountAddress = accountAddress;
    this.privateKey = privateKey;
    this.intervalId = null;
    this.isRunning = false;
  }

  // Generate random sensor data
  generateRandomData() {
    const temperature = Math.random() * 40 + 10; // Random temperature between 10-50°C
    const humidity = Math.random() * 100; // Random humidity between 0-100%
    const pressure = Math.random() * 50 + 980; // Random pressure between 980-1030 hPa
    
    return {
      temperature,
      humidity,
      pressure
    };
  }

  // Submit data to blockchain with error handling
  async submitData() {
    try {
      const data = this.generateRandomData();
      console.log(`Submitting data for device ${this.deviceId}:`, data);

      const receipt = await this.blockchainService.submitData(
        this.deviceId,
        data,
        this.accountAddress,
        this.privateKey
      );

      return {
        success: true,
        transactionHash: receipt.transactionHash,
        data,
        message: 'Data submitted successfully'
      };
    } catch (error) {
      console.error(`Failed to submit data for device ${this.deviceId}:`, error.message);
      console.log(`Waiting 3 minutes before next attempt due to submission failure...`);
      
      // According to requirements, we should ignore errors
      return {
        success: false,
        error: error.message,
        message: 'Data submission failed, but continuing...'
      };
    }
  }

  // Start periodic data submission (every 1 minute)
  start() {
    if (this.isRunning) {
      console.log('Data submitter is already running');
      return;
    }

    console.log(`Starting data submission for device ${this.deviceId} every 1 minute`);
    this.isRunning = true;

    // Submit initial data immediately
    this.submitData();

    // Set up interval for periodic submission (1 minute = 60000ms)
    this.intervalId = setInterval(async () => {
      if (this.isRunning) {
        const result = await this.submitData();
        
        // If submission fails, wait longer (3 minutes) as per requirements
        if (!result.success) {
          console.log('Submission failed, waiting longer before next attempt...');
          clearInterval(this.intervalId);
          
          // Wait 3 minutes before resuming
          setTimeout(() => {
            if (this.isRunning) {
              this.intervalId = setInterval(() => {
                if (this.isRunning) {
                  this.submitData();
                }
              }, 60000); // Resume 1-minute interval
            }
          }, 180000); // 3 minutes = 180000ms
        }
      }
    }, 60000); // 1 minute = 60000ms
  }

  // Stop periodic data submission
  stop() {
    if (!this.isRunning) {
      console.log('⚠️  Data submitter is not currently running');
      return;
    }

    console.log(`\n🛑 Stopping data submission service:`);
    console.log(`   - Device ID: ${this.deviceId}`);
    console.log(`   - Service Stopped At: ${new Date().toISOString()}`);
    console.log(`   - Total Runtime: Calculated from start time`);
    
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log(`✅ Timer interval cleared successfully`);
    }
    
    console.log(`🏁 Data submission service stopped gracefully`);
  }

  // Get current status
  getStatus() {
    return {
      deviceId: this.deviceId,
      isRunning: this.isRunning,
      intervalId: this.intervalId !== null
    };
  }
}

module.exports = DataSubmitter;