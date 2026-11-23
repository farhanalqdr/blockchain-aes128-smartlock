require('dotenv').config();
const LockListener = require('./lockListener');

async function main() {
  const listener = new LockListener({
    apiUrl: process.env.API_URL || 'http://localhost:3000',
    lockWalletAddress: process.env.LOCK_WALLET_ADDRESS,
    providerUrl: process.env.PROVIDER_URL,
    contractAddress: process.env.CONTRACT_ADDRESS,
    devicePrivateKey: process.env.DEVICE_PRIVATE_KEY,
    aesSharedKey: process.env.AES_SHARED_KEY,
    aesSharedKeyHex: process.env.AES_SHARED_KEY_HEX,
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '5000', 10),
    heartbeatIntervalMs: parseInt(process.env.HEARTBEAT_INTERVAL_MS || '30000', 10)
  });

  try {
    await listener.start();
  } catch (error) {
    console.error('Failed to start lock listener:', error.message);
    process.exit(1);
  }

  process.on('SIGINT', async () => {
    console.log('\nStopping lock listener...');
    await listener.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nStopping lock listener...');
    await listener.stop();
    process.exit(0);
  });
}

main();