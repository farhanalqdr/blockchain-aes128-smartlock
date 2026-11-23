import { network } from "hardhat";
import { config } from "dotenv";
import { readFileSync } from "fs";

config();

async function main() {
  console.log("Deploying GydPlatform contract to Polygon Amoy testnet...");

  try {
    const { viem: viemClient } = await network.connect({
      network: "amoy",
    });

    const publicClient = await viemClient.getPublicClient();
    const [deployer] = await viemClient.getWalletClients();

    console.log("Deploying contracts with account:", deployer.account.address);
    console.log("Account balance:", await publicClient.getBalance({ address: deployer.account.address }));

    const ownerName = process.env.TESTNET_OWNER_NAME || process.env.OWNER_NAME || "Amoy Owner";
    const adminAddress = process.env.TESTNET_ADMIN_ADDRESS || "0x0000000000000000000000000000000000000000";
    const adminName = process.env.TESTNET_ADMIN_NAME || "Amoy Admin";

    console.log("Owner Name:", ownerName);
    console.log("Admin Address:", adminAddress);
    console.log("Admin Name:", adminName);

    const artifact = JSON.parse(readFileSync("./artifacts/contracts/GydPlatform.sol/GydPlatform.json", "utf8"));
    const deploymentTx = await deployer.deployContract({
      abi: artifact.abi,
      bytecode: artifact.bytecode,
      args: [ownerName, adminAddress, adminName],
    });

    console.log("Deployment transaction hash:", deploymentTx);

    const receipt = await publicClient.waitForTransactionReceipt({ hash: deploymentTx });
    const contractAddress = receipt.contractAddress;

    if (!contractAddress) {
      throw new Error("Contract deployment failed - no contract address in receipt");
    }

    console.log("GydPlatform contract deployed to:", contractAddress);

    console.log("\n=== Deployment Complete ===");
    console.log("Contract Address:", contractAddress);
    console.log("Network:", "amoy");
    console.log("Chain ID:", "80002");
    console.log("Deployer:", deployer.account.address);
    console.log("Explorer:", `https://amoy.polygonscan.com/address/${contractAddress}`);

    const deploymentInfo = {
      network: "amoy",
      chainId: 80002,
      contractAddress: contractAddress,
      deployer: deployer.account.address,
      ownerName: ownerName,
      adminAddress: adminAddress,
      adminName: adminName,
      explorerUrl: `https://amoy.polygonscan.com/address/${contractAddress}`,
      deployedAt: new Date().toISOString(),
    };

    const fs = await import("fs");
    const path = await import("path");

    const deploymentsDir = path.join(process.cwd(), "deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(deploymentsDir, "gydplatform-amoy.json"),
      JSON.stringify(deploymentInfo, null, 2)
    );

    console.log("Deployment info saved to deployments/gydplatform-amoy.json");
  } catch (error) {
    console.error("Deployment failed:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
