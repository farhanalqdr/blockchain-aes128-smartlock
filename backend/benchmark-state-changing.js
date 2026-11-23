require("dotenv").config();

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { getBlockchainService } = require("./src/services/blockchainService");

function nsToMs(nsBigInt) {
  return Number(nsBigInt) / 1_000_000;
}

function msToSec(ms) {
  return Number((ms / 1000).toFixed(3));
}

function calcStats(values) {
  if (!values.length) {
    return {
      avg: 0,
      min: 0,
      max: 0,
      p50: 0,
      p95: 0,
      p99: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;

  const percentile = (p) => {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  };

  return {
    avg,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    p50: percentile(50),
    p95: percentile(95),
    p99: percentile(99),
  };
}

function randomBase64(bytes) {
  return crypto.randomBytes(bytes).toString("base64");
}

function randomHex(bytes) {
  return crypto.randomBytes(bytes).toString("hex");
}

function makeBenchmarkCommand(lockAddress, iteration) {
  return {
    lockAddress,
    encryptedPayload: randomBase64(Number(process.env.BENCH_PAYLOAD_BYTES || 256)),
    encryptedSessionKey: Buffer.from(
      `aes128-shared-v1-${iteration}-${Date.now()}`,
      "utf8"
    ).toString("base64"),
    iv: crypto.randomBytes(12).toString("base64"),
    authTag: crypto.randomBytes(16).toString("base64"),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    nonce: randomHex(32),
  };
}

function extractTransactionHash(result) {
  return (
    result?.transactionHash ||
    result?.txHash ||
    result?.hash ||
    result?.receipt?.transactionHash ||
    result?.data?.transactionHash ||
    result?.data?.txHash ||
    ""
  );
}

function extractGasUsed(result) {
  return (
    result?.gasUsed ||
    result?.receipt?.gasUsed ||
    result?.data?.gasUsed ||
    ""
  );
}

function extractCommandId(result) {
  return (
    result?.commandId ||
    result?.id ||
    result?.data?.commandId ||
    result?.data?.id ||
    ""
  );
}

function ensureBenchmarkDir() {
  const dir = path.join(process.cwd(), "benchmarks");

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return dir;
}

function saveResults(summary, results) {
  const dir = ensureBenchmarkDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  const jsonPath = path.join(
    dir,
    `backend-submitEncryptedCommand-amoy-${timestamp}.json`
  );

  const csvPath = path.join(
    dir,
    `backend-submitEncryptedCommand-amoy-${timestamp}.csv`
  );

  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        summary,
        results,
      },
      null,
      2
    )
  );

  const csvHeader = [
    "iteration",
    "status",
    "elapsedMs",
    "elapsedSeconds",
    "transactionHash",
    "commandId",
    "gasUsed",
    "error",
  ];

  const csvRows = results.map((row) =>
    [
      row.iteration,
      row.status,
      row.elapsedMs ?? "",
      row.elapsedSeconds ?? "",
      row.transactionHash || "",
      row.commandId || "",
      row.gasUsed || "",
      row.error ? `"${String(row.error).replace(/"/g, '""')}"` : "",
    ].join(",")
  );

  fs.writeFileSync(csvPath, [csvHeader.join(","), ...csvRows].join("\n"));

  console.log("");
  console.log("Benchmark JSON saved to:", jsonPath);
  console.log("Benchmark CSV saved to :", csvPath);
}

async function main() {
  const iterations = Number(
    process.argv[2] ||
      process.env.BENCH_ITERATIONS ||
      process.env.BENCHMARK_ITERATIONS ||
      5
  );

  const lockAddress =
    process.argv[3] ||
    process.env.BENCH_LOCK_ADDRESS ||
    process.env.BENCHMARK_DEVICE_ADDRESS ||
    process.env.DEVICE_ADDRESS;

  if (!Number.isInteger(iterations) || iterations <= 0) {
    throw new Error("Jumlah iterasi harus angka bulat positif.");
  }

  if (!lockAddress) {
    throw new Error(
      "BENCH_LOCK_ADDRESS wajib diisi dengan address lock/device yang sudah registered dan approved."
    );
  }

  const blockchainService = getBlockchainService();

  const results = [];
  const successTimes = [];
  const txHashes = [];

  console.log("==================================================");
  console.log("STATE-CHANGING METHOD BENCHMARK");
  console.log("==================================================");
  console.log("Network           :", process.env.NETWORK_NAME || "amoy");
  console.log("Chain ID          :", process.env.CHAIN_ID || "80002");
  console.log("Contract Address  :", process.env.CONTRACT_ADDRESS || "-");
  console.log("Method            : submitEncryptedCommandOnChain");
  console.log("Contract Function :", "submitEncryptedCommand");
  console.log("Iterations        :", iterations);
  console.log("Lock Address      :", lockAddress);
  console.log("Payload Bytes     :", process.env.BENCH_PAYLOAD_BYTES || 256);
  console.log("Started At        :", new Date().toISOString());
  console.log("");

  for (let i = 1; i <= iterations; i++) {
    const command = makeBenchmarkCommand(lockAddress, i);

    try {
      const t1 = process.hrtime.bigint();

      const result = await blockchainService.submitEncryptedCommandOnChain(command);

      const t2 = process.hrtime.bigint();

      const elapsedMs = nsToMs(t2 - t1);
      const elapsedSeconds = msToSec(elapsedMs);

      const transactionHash = extractTransactionHash(result);
      const commandId = extractCommandId(result);
      const gasUsed = extractGasUsed(result);

      successTimes.push(elapsedMs);

      if (transactionHash) {
        txHashes.push(transactionHash);
      }

      results.push({
        iteration: i,
        status: "success",
        elapsedMs: Number(elapsedMs.toFixed(3)),
        elapsedSeconds,
        transactionHash,
        commandId,
        gasUsed: gasUsed ? String(gasUsed) : "",
        rawResult: result,
      });

      console.log(
        `[${i}/${iterations}] success | ${elapsedMs.toFixed(3)} ms | ${elapsedSeconds}s | tx: ${
          transactionHash || "-"
        }`
      );
    } catch (error) {
      results.push({
        iteration: i,
        status: "failed",
        elapsedMs: "",
        elapsedSeconds: "",
        transactionHash: "",
        commandId: "",
        gasUsed: "",
        error: error.message,
      });

      console.error(`[${i}/${iterations}] failed | ${error.message}`);
    }
  }

  const stats = calcStats(successTimes);
  const successCount = successTimes.length;
  const failedCount = iterations - successCount;
  const successRate = (successCount / iterations) * 100;

  const summary = {
    benchmarkType: "backend-service-state-changing",
    network: process.env.NETWORK_NAME || "amoy",
    chainId: process.env.CHAIN_ID || "80002",
    contractAddress: process.env.CONTRACT_ADDRESS || "",
    method: "submitEncryptedCommandOnChain",
    contractFunction: "submitEncryptedCommand",
    lockAddress,
    iterations,
    successCount,
    failedCount,
    successRatePercent: Number(successRate.toFixed(2)),
    executionTimeMs: {
      avg: Number(stats.avg.toFixed(3)),
      min: Number(stats.min.toFixed(3)),
      max: Number(stats.max.toFixed(3)),
      p50: Number(stats.p50.toFixed(3)),
      p95: Number(stats.p95.toFixed(3)),
      p99: Number(stats.p99.toFixed(3)),
    },
    executionTimeSeconds: {
      avg: msToSec(stats.avg),
      min: msToSec(stats.min),
      max: msToSec(stats.max),
      p50: msToSec(stats.p50),
      p95: msToSec(stats.p95),
      p99: msToSec(stats.p99),
    },
    transactionHashes: txHashes,
    generatedAt: new Date().toISOString(),
    note:
      "Angka ini mengukur waktu eksekusi method backend submitEncryptedCommandOnChain. Jika method tersebut menunggu transaction receipt, maka hasil ini mencakup waktu konfirmasi blockchain. Jika method hanya mengirim transaksi tanpa menunggu receipt, maka hasil ini hanya mencerminkan waktu submit transaksi dari backend.",
  };

  console.log("");
  console.log("==================================================");
  console.log("BENCHMARK SUMMARY");
  console.log("==================================================");
  console.log("Execution time (ms):");
  console.log(`  avg : ${stats.avg.toFixed(3)}`);
  console.log(`  min : ${stats.min.toFixed(3)}`);
  console.log(`  max : ${stats.max.toFixed(3)}`);
  console.log(`  p50 : ${stats.p50.toFixed(3)}`);
  console.log(`  p95 : ${stats.p95.toFixed(3)}`);
  console.log(`  p99 : ${stats.p99.toFixed(3)}`);
  console.log("");
  console.log(`Success rate       : ${successCount}/${iterations} (${successRate.toFixed(2)}%)`);
  console.log("");
  console.log("Transaction hashes:");

  if (txHashes.length === 0) {
    console.log("-");
  } else {
    for (const tx of txHashes) {
      console.log(`- ${tx}`);
    }
  }

  saveResults(summary, results);

  if (successCount === 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("");
  console.error("Benchmark failed.");
  console.error(err);
  process.exitCode = 1;
});