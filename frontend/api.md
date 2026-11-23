# GydPlatform IoT Management API Documentation

## Overview

The GydPlatform IoT Management API provides endpoints for managing IoT devices and handling sensor data. The API uses JWT authentication and follows a device-to-blockchain architecture where devices submit data directly to the smart contract, and the backend processes data through blockchain event listeners.

## Base URL

```
Development: http://localhost:3000
Production: https://api.gydplatform.com
```

## Authentication

Most endpoints require JWT authentication. Include token in Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

**Demo Mode Notice**: In this demo implementation, all authenticated users automatically receive admin privileges and can access all devices and data.

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- General API: 100 requests per 15 minutes
- Authentication: 5 requests per 15 minutes

## Error Response Format

All error responses follow this format:

```json
{
  "error": "Error description",
  "code": "ERROR_CODE",
  "details": [...], // For validation errors
  "message": "Detailed error message" // In development
}
```

## Endpoints

### Authentication

#### Register User
```http
POST /api/auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "role": "owner"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt-token-here",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "role": "owner"
  }
}
```

#### Login
```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt-token-here",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "role": "owner"
  }
}
```

### Device Management

#### Get Devices
```http
GET /api/devices?page=1&limit=10&status=pending
Authorization: Bearer <token>
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `status`: Filter by status (approved, pending)

**Response:**
```json
{
  "devices": [
    {
      "_id": "device-id",
      "name": "Temperature Sensor 1",
      "macAddress": "00:11:22:33:44:55",
      "walletAddress": "0x1234567890123456789012345678901234567890",
      "owner": "user-id",
      "isApproved": false,
      "blockchainTxHash": "0xabcdef...",
      "registeredAt": "2023-01-01T00:00:00.000Z",
      "lastDataTimestamp": "2023-01-01T12:00:00.000Z",
      "lastEncryptedData": "encrypted-data-here",
      "dataCount": 15
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25
  }
}
```

#### Get Device Details
```http
GET /api/devices/:deviceId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "_id": "device-id",
  "name": "Temperature Sensor 1",
  "macAddress": "00:11:22:33:44:55",
  "walletAddress": "0x1234567890123456789012345678901234567890",
  "owner": "user-id",
  "isApproved": false,
  "blockchainTxHash": "0xabcdef...",
  "registeredAt": "2023-01-01T00:00:00.000Z",
  "lastDataTimestamp": "2023-01-01T12:00:00.000Z",
  "lastEncryptedData": "encrypted-data-here",
  "dataCount": 15
}
```

#### Get Device Status
```http
GET /api/devices/status/:deviceAddress
Authorization: Bearer <token>
```

**Response:**
```json
{
  "device": {
    "_id": "device-id",
    "name": "Temperature Sensor 1",
    "macAddress": "00:11:22:33:44:55",
    "walletAddress": "0x1234567890123456789012345678901234567890",
    "isApproved": false,
    "dataCount": 15
  },
  "blockchainStatus": false,
  "lastUpdate": "2023-01-01T12:00:00.000Z"
}
```

#### Approve Device (All Users - Demo Mode)
```http
POST /api/devices/approve/:deviceAddress
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "txHash": "0xabcdef...",
  "message": "Device approved successfully"
}
```

#### Reject Device (All Users - Demo Mode)
```http
POST /api/devices/reject/:deviceAddress
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Device rejected successfully"
}
```

#### Get All Devices (Simplified Demo Mode)
```http
GET /api/devices/all
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "_id": "device-id",
    "name": "Temperature Sensor 1",
    "macAddress": "00:11:22:33:44:55",
    "walletAddress": "0x1234567890123456789012345678901234567890",
    "isApproved": false,
    "dataCount": 15
  }
]
```

#### Search Devices
```http
GET /api/devices/search?q=sensor
Authorization: Bearer <token>
```

**Response:**
```json
[
  {
    "_id": "device-id",
    "name": "Temperature Sensor 1",
    "macAddress": "00:11:22:33:44:55",
    "walletAddress": "0x1234567890123456789012345678901234567890",
    "isApproved": false,
    "dataCount": 15
  }
]
```


### Data Management

#### Get Latest Data
```http
GET /api/data/latest/:deviceAddress
Authorization: Bearer <token>
```

**Response:**
```json
{
  "_id": "data-id",
  "deviceAddress": "0x1234567890123456789012345678901234567890",
  "encryptedData": "encrypted-sensor-data",
  "txHash": "0xabcdef...",
  "timestamp": "2023-01-01T12:00:00.000Z"
}
```

*Note: In demo mode, all users can access data from any device*

#### Get Data History
```http
GET /api/data/history/:deviceAddress?page=1&limit=50
Authorization: Bearer <token>
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50)

**Response:**
```json
{
  "data": [
    {
      "_id": "data-id",
      "deviceAddress": "0x1234567890123456789012345678901234567890",
      "encryptedData": "encrypted-sensor-data",
      "txHash": "0xabcdef...",
      "timestamp": "2023-01-01T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100
  }
}
```

*Note: In demo mode, all users can access data from any device*

#### Get All Data (Simplified Demo Mode)
```http
GET /api/data/all?page=1&limit=50
Authorization: Bearer <token>
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50)

**Response:**
```json
{
  "data": [
    {
      "_id": "data-id",
      "deviceAddress": "0x1234567890123456789012345678901234567890",
      "encryptedData": "encrypted-sensor-data",
      "txHash": "0xabcdef...",
      "timestamp": "2023-01-01T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100
  }
}
```

## Device Status

### Device Approval Status
- `approved`: Device is approved and can submit data to blockchain
- `pending`: Device is registered but awaiting admin approval

### Data Status
- `submitted`: Data has been successfully submitted to blockchain
- `encrypted`: All sensor data is encrypted before submission

## Error Codes

### Authentication Errors
- `TOKEN_MISSING`: No authentication token provided
- `TOKEN_INVALID`: Invalid authentication token
- `TOKEN_EXPIRED`: Authentication token has expired
- `USER_NOT_FOUND`: User not found
- `INVALID_CREDENTIALS`: Invalid email or password
- `ACCOUNT_DEACTIVATED`: User account is deactivated

### Validation Errors
- `VALIDATION_ERROR`: Request validation failed
- `DEVICE_ADDRESS_MISSING`: Device address required
- `SEARCH_QUERY_REQUIRED`: Search query required

### Device Errors
- `DEVICE_NOT_FOUND`: Device not found
- `DEVICE_NOT_APPROVED`: Device not approved
- `MAC_ADDRESS_EXISTS`: MAC address already exists
- `WALLET_ADDRESS_EXISTS`: Wallet address already exists
- `DEVICE_REGISTRATION_ERROR`: Device registration failed

### Data Errors
- `GET_DATA_ERROR`: Failed to retrieve data

### Blockchain Errors
- `BLOCKCHAIN_ERROR`: Blockchain operation failed
- `BLOCKCHAIN_CONNECTION_ERROR`: Cannot connect to blockchain

### Rate Limiting
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `AUTH_RATE_LIMIT_EXCEEDED`: Too many authentication attempts

## Architecture Notes

- **Device-to-Blockchain**: Devices register and submit data directly to the blockchain smart contract
- **Event-Driven Processing**: Backend listens to blockchain events for data processing
- **Simplified Permissions**: All authenticated users have admin access in demo mode
- **No WebSocket**: Removed WebSocket functionality for simplified architecture

## SDK Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

class GydPlatformAPI {
  constructor(baseURL, token) {
    this.baseURL = baseURL;
    this.token = token;
  }

  async request(method, endpoint, data = null) {
    const config = {
      method,
      url: `${this.baseURL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  }

  async getDevices(page = 1, limit = 10) {
    return this.request('GET', `/api/devices?page=${page}&limit=${limit}`);
  }

  async approveDevice(deviceAddress) {
    return this.request('POST', `/api/devices/approve/${deviceAddress}`);
  }

  async rejectDevice(deviceAddress) {
    return this.request('POST', `/api/devices/reject/${deviceAddress}`);
  }

  async getDeviceHistory(deviceAddress, startDate, endDate) {
    const query = `startDate=${startDate}&endDate=${endDate}`;
    return this.request('GET', `/api/data/history/${deviceAddress}?${query}`);
  }

  async getAllData(page = 1, limit = 50) {
    return this.request('GET', `/api/data/all?page=${page}&limit=${limit}`);
  }
}

// Usage
const api = new GydPlatformAPI('http://localhost:3000', 'your-jwt-token');

// Get devices
const devices = await api.getDevices();

// Approve device
const approval = await api.approveDevice('0x1234567890123456789012345678901234567890');

// Reject device
const rejection = await api.rejectDevice('0x1234567890123456789012345678901234567890');
```

### Python

```python
import requests
import json

class GydPlatformAPI:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.token = token
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }

    def request(self, method, endpoint, data=None):
        url = f'{self.base_url}{endpoint}'
        
        if method == 'GET':
            response = requests.get(url, headers=self.headers)
        elif method == 'POST':
            response = requests.post(url, headers=self.headers, json=data)
        elif method == 'PUT':
            response = requests.put(url, headers=self.headers, json=data)
        elif method == 'DELETE':
            response = requests.delete(url, headers=self.headers)
        
        return response.json()

    def get_devices(self, page=1, limit=10):
        return self.request('GET', f'/api/devices?page={page}&limit={limit}')

    def approve_device(self, device_address):
        return self.request('POST', f'/api/devices/approve/{device_address}')

    def reject_device(self, device_address):
        return self.request('POST', f'/api/devices/reject/{device_address}')

    def get_all_data(self, page=1, limit=50):
        return self.request('GET', f'/api/data/all?page={page}&limit={limit}')

# Usage
api = GydPlatformAPI('http://localhost:3000', 'your-jwt-token')

# Get devices
devices = api.get_devices()

# Approve device
approval = api.approve_device('0x1234567890123456789012345678901234567890')

# Reject device
rejection = api.reject_device('0x1234567890123456789012345678901234567890')
```

## Support

For API support and questions:
- Email: api-support@gydplatform.com
- Documentation: https://docs.gydplatform.com
- Status Page: https://status.gydplatform.com