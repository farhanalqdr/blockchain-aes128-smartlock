import { network } from "hardhat";
import { config } from "dotenv";
import { readFileSync } from "fs";

// Load environment variables
config();

async function main() {
  console.log("Deploying GydPlatform contract to localhost network...");

  try {
    // Get viem client for localhost network
    const { viem: viemClient } = await network.connect({
      network: "localhost",
    });

    const publicClient = await viemClient.getPublicClient();
    const [deployer] = await viemClient.getWalletClients();

    console.log("Deploying contracts with account:", deployer.account.address);
    console.log("Account balance:", await publicClient.getBalance({ address: deployer.account.address }));

    // Get configuration from environment variables
    const ownerName = process.env.OWNER_NAME || "Local Owner";
    const adminAddress = process.env.ADMIN_ADDRESS || "0x0000000000000000000000000000000000000000000";
    const adminName = process.env.ADMIN_NAME || "Default Admin";

    console.log("Owner Name:", ownerName);
    console.log("Admin Address:", adminAddress);
    console.log("Admin Name:", adminName);

    // Deploy contract with admin configuration
    const artifact = JSON.parse(readFileSync("./artifacts/contracts/GydPlatform.sol/GydPlatform.json", "utf8"));
    const deploymentTx = await deployer.deployContract({
      abi: artifact.abi,
      bytecode: artifact.bytecode,
      args: [ownerName, adminAddress, adminName],
    });

    console.log("Deployment transaction hash:", deploymentTx);
    
    // Wait for the transaction to be mined and get the contract address
    const receipt = await publicClient.waitForTransactionReceipt({ hash: deploymentTx });
    const contractAddress = receipt.contractAddress;
    
    if (!contractAddress) {
      throw new Error("Contract deployment failed - no contract address in receipt");
    }
    
    console.log("GydPlatform contract deployed to:", contractAddress);

    console.log("\n=== Deployment Complete ===");
    console.log("Contract Address:", contractAddress);
    console.log("Network:", "localhost");
    console.log("Deployer:", deployer.account.address);

    // Save deployment info
    const deploymentInfo = {
      network: "localhost",
      contractAddress: contractAddress,
      deployer: deployer.account.address,
      ownerName: ownerName,
      adminAddress: adminAddress,
      adminName: adminName,
      deployedAt: new Date().toISOString(),
    };

    const fs = await import("fs");
    const path = await import("path");
    
    const deploymentsDir = path.join(process.cwd(), "deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(deploymentsDir, "gydplatform-localhost.json"),
      JSON.stringify(deploymentInfo, null, 2)
    );

    console.log("Deployment info saved to deployments/gydplatform-localhost.json");

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