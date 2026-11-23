const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

function loadContractAbi() {
  const possiblePaths = [
    path.resolve(process.cwd(), '../dapp/artifacts/contracts/GydPlatform.sol/GydPlatform.json'),
    path.resolve(__dirname, '../../dapp/artifacts/contracts/GydPlatform.sol/GydPlatform.json'),
    path.resolve(process.cwd(), 'artifacts/contracts/GydPlatform.sol/GydPlatform.json')
  ];

  for (const artifactPath of possiblePaths) {
    if (fs.existsSync(artifactPath)) {
      const raw = fs.readFileSync(artifactPath, 'utf8');
      const artifact = JSON.parse(raw);

      if (!artifact.abi || !Array.isArray(artifact.abi)) {
        throw new Error(`ABI not found in artifact: ${artifactPath}`);
      }

      return artifact.abi;
    }
  }

  throw new Error('Contract artifact not found. Please compile dapp first.');
}

class EdgeBlockchainClient {
  constructor({ providerUrl, contractAddress, devicePrivateKey }) {
    if (!providerUrl) {
      throw new Error('PROVIDER_URL is required');
    }

    if (!contractAddress) {
      throw new Error('CONTRACT_ADDRESS is required');
    }

    if (!devicePrivateKey) {
      throw new Error('DEVICE_PRIVATE_KEY is required');
    }

    this.abi = loadContractAbi();
    this.provider = new ethers.JsonRpcProvider(providerUrl);

    const normalizedKey = devicePrivateKey.startsWith('0x')
      ? devicePrivateKey
      : `0x${devicePrivateKey}`;

    this.signer = new ethers.Wallet(normalizedKey, this.provider);
    this.contract = new ethers.Contract(contractAddress, this.abi, this.signer);
  }

  async getSignerAddress() {
    return this.signer.getAddress();
  }

  async markCommandExecuted(commandId, success, resultMessage) {
    if (!commandId) {
      throw new Error('blockchainCommandId is required');
    }

    const tx = await this.contract.markCommandExecuted(
      Number(commandId),
      Boolean(success),
      String(resultMessage || '')
    );

    const receipt = await tx.wait();
    const block = await this.provider.getBlock(receipt.blockNumber);

    return {
      success: true,
      transactionHash: tx.hash,
      blockNumber: Number(receipt.blockNumber),
      blockTimestamp: block ? new Date(Number(block.timestamp) * 1000) : null,
      signerAddress: await this.getSignerAddress()
    };
  }
}

module.exports = EdgeBlockchainClient;