const fs = require('fs');
const path = require('path');

/**
 * Load compiled contract artifact from dapp/artifacts
 * So backend always uses the newest ABI from Hardhat compile output.
 */
function loadContractArtifact() {
  const possiblePaths = [
    path.resolve(__dirname, '../../../dapp/artifacts/contracts/GydPlatform.sol/GydPlatform.json'),
    path.resolve(process.cwd(), '../dapp/artifacts/contracts/GydPlatform.sol/GydPlatform.json'),
    path.resolve(process.cwd(), 'artifacts/contracts/GydPlatform.sol/GydPlatform.json')
  ];

  for (const artifactPath of possiblePaths) {
    if (fs.existsSync(artifactPath)) {
      const artifactRaw = fs.readFileSync(artifactPath, 'utf8');
      const artifact = JSON.parse(artifactRaw);

      if (!artifact.abi || !Array.isArray(artifact.abi)) {
        throw new Error(`ABI not found in artifact: ${artifactPath}`);
      }

      return {
        abi: artifact.abi,
        artifactPath
      };
    }
  }

  throw new Error(
    'Compiled contract artifact not found. Please run "npx hardhat compile --force" inside the dapp folder first.'
  );
}

const { abi, artifactPath } = loadContractArtifact();

const contractConfig = {
  address: process.env.CONTRACT_ADDRESS || '',
  abi,
  artifactPath
};

module.exports = contractConfig;