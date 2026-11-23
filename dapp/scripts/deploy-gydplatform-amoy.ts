import { config } from "dotenv";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygonAmoy } from "viem/chains";

config();

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value || value.trim() === "") {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value.trim();
}

function normalizePrivateKey(privateKey: string): `0x${string}` {
  if (privateKey.startsWith("0x")) {
    return privateKey as `0x${string}`;
  }

  return `0x${privateKey}`;
}

async function main() {
  console.log("Deploying GydPlatform contract to Polygon Amoy testnet...");

  const rpcUrl = requireEnv("AMOY_RPC_URL");
  const privateKey = normalizePrivateKey(requireEnv("AMOY_PRIVATE_KEY"));

  const ownerName =
    process.env.TESTNET_OWNER_NAME ||
    process.env.OWNER_NAME ||
    "Amoy Owner";

  const adminAddress =
    process.env.TESTNET_ADMIN_ADDRESS ||
    process.env.ADMIN_ADDRESS;

  const adminName =
    process.env.TESTNET_ADMIN_NAME ||
    process.env.ADMIN_NAME ||
    "Amoy Admin";

  if (!adminAddress || adminAddress.trim() === "") {
    throw new Error("Missing TESTNET_ADMIN_ADDRESS or ADMIN_ADDRESS");
  }

  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    chain: polygonAmoy,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: polygonAmoy,
    transport: http(rpcUrl),
  });

  const chainId = await publicClient.getChainId();

  if (chainId !== 80002) {
    throw new Error(`Wrong chain ID. Expected 80002, got ${chainId}`);
  }

  const balance = await publicClient.getBalance({
    address: account.address,
  });

  console.log("Deploying contracts with account:", account.address);
  console.log("Account balance:", formatEther(balance), "POL");
  console.log("Owner Name:", ownerName);
  console.log("Admin Address:", adminAddress);
  console.log("Admin Name:", adminName);

  if (balance < 500000000000000000n) {
    console.warn("");
    console.warn("WARNING: Balance is below 0.5 POL.");
    console.warn("If deployment fails, top up this wallet from Polygon Amoy faucet.");
    console.warn("");
  }

  const artifactPath = join(
    process.cwd(),
    "artifacts",
    "contracts",
    "GydPlatform.sol",
    "GydPlatform.json"
  );

  if (!existsSync(artifactPath)) {
    throw new Error(
      "Artifact not found. Please run: npx hardhat compile"
    );
  }

  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));

  console.log("Sending deployment transaction...");

  const deploymentHash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode as `0x${string}`,
    args: [
      ownerName,
      adminAddress as `0x${string}`,
      adminName,
    ],
  });

  console.log("Deployment transaction hash:", deploymentHash);
  console.log("Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: deploymentHash,
    confirmations: 2,
  });

  if (!receipt.contractAddress) {
    throw new Error("Deployment failed. No contract address found in receipt.");
  }

  const contractAddress = receipt.contractAddress;

  console.log("");
  console.log("=== Deployment Complete ===");
  console.log("Contract Address:", contractAddress);
  console.log("Network: amoy");
  console.log("Chain ID: 80002");
  console.log("Deployer:", account.address);
  console.log("Transaction Hash:", deploymentHash);
  console.log("Explorer:", `https://amoy.polygonscan.com/address/${contractAddress}`);

  const deploymentInfo = {
    network: "amoy",
    chainId: 80002,
    contractAddress,
    deployer: account.address,
    ownerName,
    adminAddress,
    adminName,
    explorerUrl: `https://amoy.polygonscan.com/address/${contractAddress}`,
    transactionHash: deploymentHash,
    deployedAt: new Date().toISOString(),
  };

  const deploymentsDir = join(process.cwd(), "deployments");

  if (!existsSync(deploymentsDir)) {
    mkdirSync(deploymentsDir, { recursive: true });
  }

  writeFileSync(
    join(deploymentsDir, "gydplatform-amoy.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("");
  console.log("Deployment info saved to deployments/gydplatform-amoy.json");

  const envPath = join(process.cwd(), ".env");

  if (existsSync(envPath)) {
    const currentEnv = readFileSync(envPath, "utf8");
    const newContractLine = `CONTRACT_ADDRESS=${contractAddress}`;

    let updatedEnv = currentEnv;

    if (currentEnv.includes("CONTRACT_ADDRESS=")) {
      updatedEnv = currentEnv.replace(
        /CONTRACT_ADDRESS=.*/g,
        newContractLine
      );
    } else {
      updatedEnv = `${currentEnv.trim()}\n${newContractLine}\n`;
    }

    writeFileSync(envPath, updatedEnv);

    console.log("CONTRACT_ADDRESS updated in dapp/.env");
  }

  console.log("");
  console.log("Next steps:");
  console.log("1. Copy CONTRACT_ADDRESS to backend/.env");
  console.log("2. Copy CONTRACT_ADDRESS to frontend/client .env if needed");
  console.log("3. Copy CONTRACT_ADDRESS to edge/.env");
  console.log("4. Register device manually from frontend");
}

main().catch((error) => {
  console.error("");
  console.error("Deployment failed.");
  console.error(error);
  process.exitCode = 1;
});