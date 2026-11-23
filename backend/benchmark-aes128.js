const crypto = require('crypto');

function getAesKey() {
  const hexKey = process.env.AES_SHARED_KEY_HEX;
  if (hexKey) {
    const clean = hexKey.trim().replace(/^0x/, '');
    if (!/^[0-9a-fA-F]{32}$/.test(clean)) {
      throw new Error('AES_SHARED_KEY_HEX must be exactly 32 hex characters (16 bytes)');
    }
    return Buffer.from(clean, 'hex');
  }

  const textKey = process.env.AES_SHARED_KEY;
  if (!textKey) {
    throw new Error('Set AES_SHARED_KEY (16 chars) or AES_SHARED_KEY_HEX (32 hex chars)');
  }

  const keyBuffer = Buffer.from(textKey, 'utf8');
  if (keyBuffer.length !== 16) {
    throw new Error('AES_SHARED_KEY must be exactly 16 bytes / 16 ASCII characters');
  }

  return keyBuffer;
}

function encryptPayload(payload, keyBuffer) {
  const plaintext = JSON.stringify(payload);
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
}

function decryptPayload(pkg, keyBuffer) {
  const ivBuffer = Buffer.from(pkg.iv, 'base64');
  const authTagBuffer = Buffer.from(pkg.authTag, 'base64');
  const encryptedBuffer = Buffer.from(pkg.encryptedPayload, 'base64');

  const decipher = crypto.createDecipheriv('aes-128-gcm', keyBuffer, ivBuffer);
  decipher.setAuthTag(authTagBuffer);

  const decryptedBuffer = Buffer.concat([
    decipher.update(encryptedBuffer),
    decipher.final()
  ]);

  return JSON.parse(decryptedBuffer.toString('utf8'));
}

function nsToMs(nsBigInt) {
  return Number(nsBigInt) / 1_000_000;
}

function calcStats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const p95 = sorted[Math.floor(values.length * 0.95) - 1] ?? sorted[sorted.length - 1];

  return {
    avg,
    min,
    max,
    p95
  };
}

async function main() {
  const key = getAesKey();
  const iterations = Number(process.env.BENCH_ITERATIONS || 200);

  const payload = {
    command: 'UNLOCK',
    targetLock: '0xFc6EA848F73DAD91D2dE2FcC84B50bB5E513fb19',
    issuedBy: '0x73258b2163fC260442556d35f8549BD40Dda0E1e',
    nonce: crypto.randomBytes(32).toString('hex'),
    issuedAt: Math.floor(Date.now() / 1000),
    expiresAt: Math.floor(Date.now() / 1000) + 300
  };

  const payloadSizeBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');

  const encryptTimes = [];
  const decryptTimes = [];
  let verified = 0;

  // warm-up
  for (let i = 0; i < 20; i++) {
    const enc = encryptPayload(payload, key);
    decryptPayload(enc, key);
  }

  for (let i = 0; i < iterations; i++) {
    const t1 = process.hrtime.bigint();
    const encrypted = encryptPayload(payload, key);
    const t2 = process.hrtime.bigint();

    const decrypted = decryptPayload(encrypted, key);
    const t3 = process.hrtime.bigint();

    encryptTimes.push(nsToMs(t2 - t1));
    decryptTimes.push(nsToMs(t3 - t2));

    if (JSON.stringify(decrypted) === JSON.stringify(payload)) {
      verified++;
    }
  }

  const encStats = calcStats(encryptTimes);
  const decStats = calcStats(decryptTimes);

  console.log('=== AES-128-GCM BENCHMARK ===');
  console.log(`Iterations        : ${iterations}`);
  console.log(`Payload size      : ${payloadSizeBytes} bytes`);
  console.log(`Verified decrypts : ${verified}/${iterations}`);
  console.log('');
  console.log('Encryption (ms):');
  console.log(`  avg : ${encStats.avg.toFixed(3)}`);
  console.log(`  min : ${encStats.min.toFixed(3)}`);
  console.log(`  max : ${encStats.max.toFixed(3)}`);
  console.log(`  p95 : ${encStats.p95.toFixed(3)}`);
  console.log('');
  console.log('Decryption (ms):');
  console.log(`  avg : ${decStats.avg.toFixed(3)}`);
  console.log(`  min : ${decStats.min.toFixed(3)}`);
  console.log(`  max : ${decStats.max.toFixed(3)}`);
  console.log(`  p95 : ${decStats.p95.toFixed(3)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});