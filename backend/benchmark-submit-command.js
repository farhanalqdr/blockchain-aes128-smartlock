require('dotenv').config();
const crypto = require('crypto');
const { getBlockchainService } = require('./src/services/blockchainService');

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

  return { avg, min, max, p95 };
}

function randomBase64(bytes) {
  return crypto.randomBytes(bytes).toString('base64');
}

function makeBenchmarkCommand(lockAddress) {
  return {
    lockAddress,
    encryptedPayload: randomBase64(256),
    encryptedSessionKey: Buffer.from('aes128-shared-v1', 'utf8').toString('base64'),
    iv: crypto.randomBytes(12).toString('base64'),
    authTag: crypto.randomBytes(16).toString('base64'),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    nonce: crypto.randomBytes(32).toString('hex')
  };
}

async function main() {
  const iterations = Number(process.argv[2] || process.env.BENCH_ITERATIONS || 5);
  const lockAddress = process.argv[3] || process.env.BENCH_LOCK_ADDRESS;

  if (!lockAddress) {
    throw new Error('BENCH_LOCK_ADDRESS is required (address lock/device yang sudah approved)');
  }

  const blockchainService = getBlockchainService();
  const times = [];
  let success = 0;
  const txHashes = [];

  console.log('=== STATE-CHANGING METHOD BENCHMARK ===');
  console.log('Method            : submitEncryptedCommand');
  console.log(`Iterations        : ${iterations}`);
  console.log(`Lock Address      : ${lockAddress}`);
  console.log('');

  for (let i = 0; i < iterations; i++) {
    try {
      const command = makeBenchmarkCommand(lockAddress);

      const t1 = process.hrtime.bigint();
      const result = await blockchainService.submitEncryptedCommandOnChain(command);
      const t2 = process.hrtime.bigint();

      const elapsedMs = nsToMs(t2 - t1);
      times.push(elapsedMs);
      success += 1;
      txHashes.push(result.transactionHash);

      console.log(
        `[${i + 1}/${iterations}] success | ${elapsedMs.toFixed(3)} ms | tx: ${result.transactionHash}`
      );
    } catch (error) {
      console.error(`[${i + 1}/${iterations}] failed | ${error.message}`);
    }
  }

  if (times.length === 0) {
    console.log('\nNo successful transactions.');
    process.exit(1);
  }

  const stats = calcStats(times);
  const successRate = (success / iterations) * 100;

  console.log('');
  console.log('Execution time (ms):');
  console.log(`  avg : ${stats.avg.toFixed(3)}`);
  console.log(`  min : ${stats.min.toFixed(3)}`);
  console.log(`  max : ${stats.max.toFixed(3)}`);
  console.log(`  p95 : ${stats.p95.toFixed(3)}`);
  console.log('');
  console.log(`Success rate       : ${success}/${iterations} (${successRate.toFixed(2)}%)`);
  console.log('');
  console.log('Transaction hashes:');
  for (const tx of txHashes) {
    console.log(`- ${tx}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});