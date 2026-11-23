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

function tamperHexString(value) {
  if (!value || typeof value !== 'string') {
    throw new Error('Nonce tidak valid atau kosong.');
  }

  let clean = value.replace(/^0x/i, '');

  if (clean.length < 8) {
    throw new Error(`Nonce terlalu pendek untuk diubah: ${value}`);
  }

  const chars = clean.split('');

  const index = chars.length - 1;
  chars[index] = chars[index].toLowerCase() === 'a' ? 'b' : 'a';

  const tampered = chars.join('');

  return value.startsWith('0x') ? `0x${tampered}` : tampered;
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
    console.log('1. Service Raspberry sedang stop.');
    console.log('2. Command baru sudah dikirim dari web dApp.');
    console.log('3. Command belum expired.');
    console.log('4. Command sudah memiliki blockchainCommandId.');
    return;
  }

  const originalNonce = command.nonce;
  const tamperedNonce = tamperHexString(originalNonce);

  command.nonce = tamperedNonce;
  command.processingError = 'Tamper test: nonce metadata was manually modified in MongoDB';
  command.metadata = {
    ...(command.metadata || {}),
    tamperTest: true,
    tamperedField: 'nonce',
    tamperedAt: new Date(),
    tamperDescription:
      `Nonce diubah manual dari ${originalNonce} menjadi ${tamperedNonce} untuk menguji blockchain hash mismatch`
  };

  await command.save();

  console.log('');
  console.log('=== NONCE TAMPERING BERHASIL DILAKUKAN ===');
  console.log('Command ID             :', command._id.toString());
  console.log('Command Type           :', command.commandType);
  console.log('Lock Address           :', command.lockAddress);
  console.log('Status                 :', command.status);
  console.log('Expires At             :', command.expiresAt);
  console.log('Blockchain Command ID  :', command.blockchainCommandId);
  console.log('');
  console.log('Field Tampered         : nonce');
  console.log('Original nonce         :', originalNonce);
  console.log('Tampered nonce         :', tamperedNonce);
  console.log('');
  console.log('Catatan: encryptedPayload, iv, authTag, dan data blockchain tidak diubah.');
  console.log('');
  console.log('Expected result:');
  console.log('1. Raspberry mengambil command pending.');
  console.log('2. Raspberry membaca command asli dari blockchain.');
  console.log('3. Raspberry menghitung hash data MongoDB dan hash data blockchain.');
  console.log('4. Hash tidak cocok karena nonce MongoDB sudah diubah.');
  console.log('5. Command ditolak sebagai tampered dan tidak dieksekusi.');
}

main()
  .catch((error) => {
    console.error('');
    console.error('Nonce tamper script failed.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });