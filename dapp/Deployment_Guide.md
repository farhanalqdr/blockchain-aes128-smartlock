# GydPlatform Deployment Guide

## Overview
This guide explains how to deploy the GydPlatform smart contract to both local Hardhat network and Sepolia testnet.

## Prerequisites

1. **Node.js and npm installed**
2. **Hardhat configured** (already set up in this project)
3. **Environment variables configured** (see `.env.example`)

## Environment Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your actual values:
   - `SEPOLIA_RPC_URL`: Your Sepolia RPC URL (get from Infura, Alchemy, etc.)
   - `SEPOLIA_PRIVATE_KEY`: Your private key for deployment
   - `OWNER_NAME`: Name for the contract owner

## Deployment Commands

### 1. Local Hardhat Network

Deploy to local Hardhat for testing:

```bash
npx hardhat run scripts/deploy-gydplatform-local.ts --network hardhatMainnet
```

This will:
- Deploy contract to local Hardhat network
- Save deployment info to `deployments/gydplatform-hardhatMainnet.json`
- Display contract address and initial state

### 2. Sepolia Testnet

Deploy to Sepolia testnet:

```bash
npx hardhat run scripts/deploy-gydplatform-testnet.ts --network sepolia
```

This will:
- Deploy contract to Sepolia testnet
- Save deployment info to `deployments/gydplatform-sepolia.json`
- Display contract address and transaction hash

## Deployment Files

After deployment, you'll find:

### `deployments/gydplatform-hardhatMainnet.json`
```json
{
  "network": "hardhatMainnet",
  "contractAddress": "0x...",
  "deployer": "0x...",
  "ownerName": "Local Owner",
  "deployedAt": "2025-01-01T..."
}
```

### `deployments/gydplatform-sepolia.json`
```json
{
  "network": "sepolia",
  "contractAddress": "0x...",
  "deployer": "0x...",
  "ownerName": "Testnet Owner",
  "deployedAt": "2025-01-01T..."
}
```

## Post-Deployment Verification

### Verify Contract on Etherscan (Sepolia)

```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS> "Testnet Owner"
```

### Test Contract Interaction

After deployment, you can test the contract:

1. **Check Owner**:
   ```javascript
   const owner = await contract.read.owner();
   console.log("Owner:", owner);
   ```

2. **Register Admin**:
   ```javascript
   await contract.write.registerAdmin(adminAddress, "Admin Name");
   ```

3. **Register Device**:
   ```javascript
   await contract.write.registerDevice("Device Name", "AA:BB:CC:DD:EE:FF");
   ```

4. **Approve Device**:
   ```javascript
   await contract.write.approveDevice(deviceAddress);
   ```

5. **Submit Data**:
   ```javascript
   await contract.write.submitEncryptedData("encrypted_sensor_data");
   ```

## Network-Specific Considerations

### Local Hardhat
- No real gas costs
- Instant transaction confirmation
- Perfect for development and testing

### Sepolia Testnet
- Uses real test ETH (has value but is free)
- Requires real gas for transactions
- Transactions take ~12 seconds to confirm
- Contract is publicly verifiable on Etherscan

## Troubleshooting

### Common Issues

1. **"Network not defined" error**:
   - Check `hardhat.config.ts` for network configuration
   - Ensure network name matches config

2. **"Private key invalid" error**:
   - Ensure private key starts with `0x`
   - Check private key corresponds to the account with funds

3. **"Insufficient funds" error**:
   - Ensure deployer account has enough ETH for gas
   - Get test ETH from Sepolia faucet

4. **"Contract verification failed" error**:
   - Ensure constructor parameters match exactly
   - Check contract was deployed successfully

### Getting Test ETH

For Sepolia testnet, you can get free test ETH from:
- [Sepolia Faucet](https://sepolia-faucet.pk910.de/)
- [Sepolia Faucet](https://faucet.sepolia.dev/)
- [Alchemy Sepolia Faucet](https://sepoliafaucet.com/)

## Security Notes

1. **Never commit private keys** to version control
2. **Use environment variables** for sensitive data
3. **Test on local network first** before deploying to testnet
4. **Keep .env file private** and out of source control

## Next Steps

After successful deployment:

1. **Integration Testing**: Test all contract functions
2. **Frontend Integration**: Connect your dApp to the deployed contract
3. **Server Setup**: Configure server to listen for `DataSubmitted` events
4. **Device Onboarding**: Register your actual IoT devices

## Contract ABI Reference

The deployed contract ABI is available in:
`artifacts/contracts/GydPlatform.sol/GydPlatform.json`

Key events to listen for:
- `AdminRegistered`
- `AdminChanged`
- `DeviceRegistered`
- `DeviceApproved`
- `DeviceRejected`
- `DataSubmitted`

## Gas Estimates

- **Deployment**: ~2,500,000 gas
- **Register Admin**: ~50,000 gas
- **Register Device**: ~80,000 gas
- **Approve Device**: ~45,000 gas
- **Submit Data**: ~60,000 gas (varies with data size)