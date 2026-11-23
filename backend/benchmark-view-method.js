require('dotenv').config();
const { ethers } = require('ethers');
const contractConfig = require('./src/config/contract');

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

function getProvider() {
  const rpcUrl = process.env.RPC_URL || process.env.PROVIDER_URL;
  if (!rpcUrl) {
    throw new Error('RPC_URL or PROVIDER_URL is required in .env');
  }
  return new ethers.JsonRpcProvider(rpcUrl);
}

function getContract(provider) {
  if (!contractConfig.address) {
    throw new Error('CONTRACT_ADDRESS is missing');
  }
  return new ethers.Contract(contractConfig.address, contractConfig.abi, provider);
}

function getViewFunctions(abi) {
  return abi
    .filter(
      (item) =>
        item.type === 'function' &&
        (item.stateMutability === 'view' || item.stateMutability === 'pure')
    )
    .map((item) => ({
      name: item.name,
      signature: `${item.name}(${(item.inputs || []).map((i) => i.type).join(',')})`,
      inputs: item.inputs || [],
      outputs: item.outputs || []
    }));
}

async function main() {
  const command = process.argv[2];

  const provider = getProvider();
  const contract = getContract(provider);
  const viewFunctions = getViewFunctions(contractConfig.abi);

  if (!command || command === 'list') {
    console.log('=== AVAILABLE VIEW/PURE METHODS ===');
    if (viewFunctions.length === 0) {
      console.log('No view/pure methods found in ABI.');
      return;
    }

    for (const fn of viewFunctions) {
      console.log(`- ${fn.signature}`);
    }

    console.log('\nCara pakai:');
    console.log('node benchmark-view-method.js <methodName> \'[arg1,arg2,...]\' <iterations>');
    console.log("Contoh:");
    console.log("node benchmark-view-method.js owner '[]' 100");
    return;
  }

  const methodName = command;
  const argsJson = process.argv[3] || '[]';
  const iterations = Number(process.argv[4] || process.env.BENCH_ITERATIONS || 100);

  let args;
  try {
    args = JSON.parse(argsJson);
    if (!Array.isArray(args)) {
      throw new Error('Args must be a JSON array');
    }
  } catch (error) {
    throw new Error(`Failed to parse args JSON: ${error.message}`);
  }

  const targetFn = viewFunctions.find((fn) => fn.name === methodName);
  if (!targetFn) {
    throw new Error(`View/pure method "${methodName}" not found in ABI`);
  }

  // warm-up
  for (let i = 0; i < 10; i++) {
    await contract[methodName](...args);
  }

  const times = [];
  let lastResult = null;

  for (let i = 0; i < iterations; i++) {
    const t1 = process.hrtime.bigint();
    lastResult = await contract[methodName](...args);
    const t2 = process.hrtime.bigint();
    times.push(nsToMs(t2 - t1));
  }

  const stats = calcStats(times);

  console.log('=== VIEW METHOD BENCHMARK ===');
  console.log(`Method            : ${methodName}`);
  console.log(`Args              : ${argsJson}`);
  console.log(`Iterations        : ${iterations}`);
  console.log('');
  console.log('Execution time (ms):');
  console.log(`  avg : ${stats.avg.toFixed(3)}`);
  console.log(`  min : ${stats.min.toFixed(3)}`);
  console.log(`  max : ${stats.max.toFixed(3)}`);
  console.log(`  p95 : ${stats.p95.toFixed(3)}`);
  console.log('');
  console.log('Last result:');
  console.dir(lastResult, { depth: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});