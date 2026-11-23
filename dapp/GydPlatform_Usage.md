# GydPlatform Contract Usage Guide

## Overview
The GydPlatform contract is a simplified IoT device management system that allows:
- Owner and admin registration
- Device registration and approval
- Encrypted data submission from approved devices
- Event emission for server integration

## Contract Deployment

### Constructor
```solidity
constructor(string memory _ownerName)
```
- **Purpose**: Deploys the contract and registers the deployer as the owner
- **Parameters**: 
  - `_ownerName`: Name of the owner
- **Example**: `constructor("John Doe")`

## Core Functions

### 1. Admin Management

#### Register Admin (Owner only)
```solidity
function registerAdmin(address _adminAddress, string memory _name) external onlyOwner
```
- **Purpose**: Owner registers an admin
- **Parameters**:
  - `_adminAddress`: Wallet address of the admin
  - `_name`: Name of the admin
- **Event**: `AdminRegistered(address indexed adminAddress, string name, uint256 timestamp)`

#### Change Admin (Owner only)
```solidity
function changeAdmin(address _newAdminAddress, string memory _name) external onlyOwner
```
- **Purpose**: Owner changes the admin
- **Parameters**:
  - `_newAdminAddress`: New admin wallet address
  - `_name`: Name of the new admin
- **Event**: `AdminChanged(address indexed oldAdmin, address indexed newAdmin, string name)`

### 2. Device Management

#### Register Device
```solidity
function registerDevice(string memory _name, string memory _macAddress) external
```
- **Purpose**: Device self-registration
- **Parameters**:
  - `_name`: Device name
  - `_macAddress`: Unique MAC address
- **Requirements**: 
  - Device must not be already registered
  - MAC address must be unique
  - Caller must not have an existing role
- **Event**: `DeviceRegistered(address indexed deviceAddress, string name, string macAddress)`

#### Approve Device (Admin only)
```solidity
function approveDevice(address _deviceAddress) external onlyAdmin
```
- **Purpose**: Admin approves a registered device
- **Parameters**:
  - `_deviceAddress`: Wallet address of the device
- **Event**: `DeviceApproved(address indexed deviceAddress, uint256 timestamp)`

#### Reject Device (Admin only)
```solidity
function rejectDevice(address _deviceAddress) external onlyAdmin
```
- **Purpose**: Admin rejects an approved device
- **Parameters**:
  - `_deviceAddress`: Wallet address of the device
- **Event**: `DeviceRejected(address indexed deviceAddress, uint256 timestamp)`

### 3. Data Submission

#### Submit Encrypted Data (Approved devices only)
```solidity
function submitEncryptedData(string memory _encryptedData) external onlyApprovedDevice
```
- **Purpose**: Approved devices submit encrypted sensor data
- **Parameters**:
  - `_encryptedData`: Encrypted sensor data payload
- **Requirements**:
  - Device must be approved
  - Encrypted data must not be empty
- **Event**: `DataSubmitted(address indexed deviceAddress, string encryptedData, uint256 timestamp)`
- **Note**: Only stores the current state (not time series)

## Getter Functions

### Device Information
```solidity
function getDeviceByMac(string memory _macAddress) external view returns (address)
```
- Returns the wallet address for a given MAC address

```solidity
function getDeviceData(address _deviceAddress) external view returns (
    string memory name,
    string memory macAddress,
    bool isApproved,
    string memory currentEncryptedData,
    uint256 lastDataTimestamp
)
```
- Returns complete device information

### User Information
```solidity
function getUserInfo(address _userAddress) external view returns (
    UserRole role,
    string memory name,
    bool isActive,
    uint256 registeredAt
)
```
- Returns user information including role

### Status Checks
```solidity
function isDeviceApproved(address _deviceAddress) external view returns (bool)
```
- Checks if a device is approved

### Counters
```solidity
function getDeviceCount() external view returns (uint256)
function getApprovedDeviceCount() external view returns (uint256)
function getUserCount() external view returns (uint256)
```
- Returns various counters

## Workflow Example

### 1. Initial Setup
```javascript
// Deploy contract (deployer becomes owner)
const contract = await deploy("GydPlatform", ["Alice Owner"]);

// Owner registers admin
await contract.registerAdmin(adminAddress, "Bob Admin");
```

### 2. Device Registration
```javascript
// Device registers itself
await contract.connect(deviceWallet).registerDevice("Temperature Sensor 1", "AA:BB:CC:DD:EE:FF");
```

### 3. Device Approval
```javascript
// Admin approves device
await contract.connect(adminWallet).approveDevice(deviceAddress);
```

### 4. Data Submission
```javascript
// Device submits encrypted data
await contract.connect(deviceWallet).submitEncryptedData("encrypted_payload_here");
```

### 5. Server Integration
```javascript
// Listen for DataSubmitted events
contract.on("DataSubmitted", (deviceAddress, encryptedData, timestamp) => {
    // Decrypt and process data on server
    console.log(`Data from ${deviceAddress}: ${encryptedData}`);
});
```

## Security Features

1. **Role-based Access Control**: Only authorized users can perform specific actions
2. **Device Approval**: Only approved devices can submit data
3. **Unique MAC Addresses**: Prevents duplicate device registrations
4. **Event Logging**: All important actions emit events for transparency

## Gas Optimization

- Only stores current encrypted data state (not historical data)
- Uses efficient mappings for lookups
- Minimal data structures
- No complex validation logic

## Integration Notes

- The `DataSubmitted` event should be monitored by your server for real-time data processing
- Encrypted data is stored on-chain but decryption happens off-chain
- MAC addresses serve as unique device identifiers
- All timestamps use block.timestamp