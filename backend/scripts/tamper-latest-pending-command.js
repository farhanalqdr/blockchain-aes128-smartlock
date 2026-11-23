require('dotenv').config();

const mongoose = require('mongoose');
const Command = require('../src/models/Command');

function getMongoUri() {
  return (
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    process.env.MONGO_URL ||
    process.env.DATABASE_URL
  );
}

function tamperBase64(value) {
  if (typeof value !== 'string' || value.length < 4) {
    throw new Error('Value is not a valid string to tamper');
  }

  const chars = value.split('');
  const index = Math.max(0, chars.length - 2);

  chars[index] = chars[index] === 'A' ? 'B' : 'A';

  return chars.join('');
}

async function main() {
  const mongoUri = getMongoUri();

  if (!mongoUri) {
    throw new Error('MongoDB URI tidak ditemukan di .env backend');
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);

  const now = new Date();

  const command = await Command.findOne({
    status: 'pending',
    processingStatus: 'processed',
    blockchainCommandId: { $ne: null },
    expiresAt: { $gt: now }
  }).sort({ submittedAt: -1, createdAt: -1 });

  if (!command) {
    console.log('');
    console.log('Tidak ada command pending yang valid untuk di-tamper.');
    console.log('Pastikan:');
    console.log('1. Raspberry service sedang stop.');
    console.log('2. Command baru sudah dikirim dari web dApp.');
    console.log('3. Command belum expired.');
    console.log('4. Command sudah berhasil submitted on-chain.');
    return;
  }

  const originalAuthTag = command.authTag;
  const tamperedAuthTag = tamperBase64(originalAuthTag);

  command.authTag = tamperedAuthTag;
  command.processingError = 'Tamper test: authTag was manually modified in MongoDB';
  command.metadata = {
    ...(command.metadata || {}),
    tamperTest: true,
    tamperedField: 'authTag',
    tamperedAt: new Date(),
    tamperDescription:
      'authTag command diubah manual untuk menguji deteksi data tampering pada AES-128-GCM'
  };

  await command.save();

  console.log('');
  console.log('=== DATA TAMPERING BERHASIL DILAKUKAN ===');
  console.log('Command ID       :', command._id.toString());
  console.log('Command Type     :', command.commandType);
  console.log('Lock Address     :', command.lockAddress);
  console.log('Status           :', command.status);
  console.log('Expires At       :', command.expiresAt);
  console.log('Blockchain ID    :', command.blockchainCommandId);
  console.log('');
  console.log('Field Tampered   : authTag');
  console.log('Original authTag :', originalAuthTag);
  console.log('Tampered authTag :', tamperedAuthTag);
  console.log('');
  console.log('Expected result:');
  console.log('1. Raspberry Pi mengambil command pending.');
  console.log('2. Dekripsi AES-128-GCM gagal.');
  console.log('3. Command tidak dieksekusi sebagai command valid.');
  console.log('4. Status command berubah menjadi failed.');
}

main()
  .catch((error) => {
    console.error('');
    console.error('Tamper script failed.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });