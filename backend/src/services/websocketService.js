const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../middleware/auth');
const { checkWebsocketRateLimit } = require('../middleware/rateLimit');
const logger = require('../utils/logger');

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // Map of ws connection to client info
    this.userConnections = new Map(); // Map of userId to Set of connections
    this.deviceSubscriptions = new Map(); // Map of deviceAddress to Set of connections
    this.eventCallbacks = new Map(); // Event callbacks for real-time updates
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server) {
    try {
      this.wss = new WebSocket.Server({ 
        server,
        path: '/ws',
        verifyClient: this.verifyClient.bind(this)
      });

      this.wss.on('connection', this.handleConnection.bind(this));
      this.wss.on('error', this.handleError.bind(this));

      // Heartbeat to detect dead connections
      this.startHeartbeat();

      logger.info('WebSocket server initialized');
    } catch (error) {
      logger.error('Failed to initialize WebSocket server:', error);
      throw error;
    }
  }

  /**
   * Verify client connection (authentication)
   */
  verifyClient(info) {
    try {
      const url = new URL(info.req.url, 'http://localhost');
      const token = url.searchParams.get('token');
      const deviceAddress = url.searchParams.get('device');
      const timestamp = url.searchParams.get('timestamp');

      // Check rate limiting
      if (!checkWebsocketRateLimit(null, info.req)) {
        return false;
      }

      // For device connections
      if (deviceAddress && timestamp) {
        // Device authentication logic here
        // For now, we'll allow device connections
        return true;
      }

      // For user connections (require token)
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          info.req.user = decoded;
          return true;
        } catch (error) {
          logger.warn('WebSocket authentication failed:', error.message);
          return false;
        }
      }

      return false;
    } catch (error) {
      logger.error('WebSocket client verification error:', error);
      return false;
    }
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, req) {
    try {
      const clientId = this.generateClientId();
      const connectionInfo = {
        id: clientId,
        ws,
        user: req.user,
        deviceAddress: null,
        subscriptions: new Set(),
        lastPing: Date.now(),
        isAlive: true,
        connectedAt: new Date()
      };

      // Store connection
      this.clients.set(ws, connectionInfo);

      // Add to user connections if authenticated user
      if (req.user) {
        if (!this.userConnections.has(req.user.userId)) {
          this.userConnections.set(req.user.userId, new Set());
        }
        this.userConnections.get(req.user.userId).add(ws);
      }

      // Send welcome message
      this.sendToClient(ws, {
        type: 'connected',
        clientId,
        timestamp: new Date(),
        message: 'Connected to WebSocket server'
      });

      // Set up message handlers
      ws.on('message', (message) => this.handleMessage(ws, message));
      ws.on('close', () => this.handleDisconnection(ws));
      ws.on('pong', () => this.handlePong(ws));

      logger.info(`WebSocket connection established: ${clientId}`);

    } catch (error) {
      logger.error('WebSocket connection error:', error);
      ws.close();
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(ws, message) {
    try {
      const connectionInfo = this.clients.get(ws);
      if (!connectionInfo) return;

      const data = JSON.parse(message.toString());
      const { type, payload } = data;

      switch (type) {
        case 'subscribe':
          this.handleSubscription(ws, payload);
          break;
        case 'unsubscribe':
          this.handleUnsubscription(ws, payload);
          break;
        case 'ping':
          this.sendToClient(ws, { type: 'pong', timestamp: new Date() });
          break;
        case 'device_data':
          this.handleDeviceData(ws, payload);
          break;
        default:
          this.sendToClient(ws, {
            type: 'error',
            message: `Unknown message type: ${type}`,
            timestamp: new Date()
          });
      }

    } catch (error) {
      logger.error('WebSocket message handling error:', error);
      this.sendToClient(ws, {
        type: 'error',
        message: 'Invalid message format',
        timestamp: new Date()
      });
    }
  }

  /**
   * Handle subscription requests
   */
  handleSubscription(ws, payload) {
    try {
      const connectionInfo = this.clients.get(ws);
      if (!connectionInfo) return;

      const { channel, deviceId } = payload;

      switch (channel) {
        case 'device_data':
          if (deviceId) {
            // Subscribe to specific device data
            connectionInfo.subscriptions.add(`device:${deviceId}`);
            
            if (!this.deviceSubscriptions.has(deviceId)) {
              this.deviceSubscriptions.set(deviceId, new Set());
            }
            this.deviceSubscriptions.get(deviceId).add(ws);
          }
          break;

        case 'user_devices':
          // Subscribe to all devices for the user
          if (connectionInfo.user) {
            connectionInfo.subscriptions.add(`user:${connectionInfo.user.userId}`);
          }
          break;

        case 'alerts':
          // Subscribe to alerts
          connectionInfo.subscriptions.add('alerts');
          break;

        default:
          this.sendToClient(ws, {
            type: 'error',
            message: `Unknown subscription channel: ${channel}`,
            timestamp: new Date()
          });
          return;
      }

      this.sendToClient(ws, {
        type: 'subscribed',
        channel,
        deviceId,
        timestamp: new Date()
      });

      logger.info(`Client ${connectionInfo.id} subscribed to ${channel}${deviceId ? `:${deviceId}` : ''}`);

    } catch (error) {
      logger.error('WebSocket subscription error:', error);
    }
  }

  /**
   * Handle unsubscription requests
   */
  handleUnsubscription(ws, payload) {
    try {
      const connectionInfo = this.clients.get(ws);
      if (!connectionInfo) return;

      const { channel, deviceId } = payload;
      const subscriptionKey = `${channel}${deviceId ? `:${deviceId}` : ''}`;
      
      connectionInfo.subscriptions.delete(subscriptionKey);

      // Remove from device subscriptions if applicable
      if (channel === 'device_data' && deviceId) {
        const deviceSubs = this.deviceSubscriptions.get(deviceId);
        if (deviceSubs) {
          deviceSubs.delete(ws);
          if (deviceSubs.size === 0) {
            this.deviceSubscriptions.delete(deviceId);
          }
        }
      }

      this.sendToClient(ws, {
        type: 'unsubscribed',
        channel,
        deviceId,
        timestamp: new Date()
      });

      logger.info(`Client ${connectionInfo.id} unsubscribed from ${channel}${deviceId ? `:${deviceId}` : ''}`);

    } catch (error) {
      logger.error('WebSocket unsubscription error:', error);
    }
  }

  /**
   * Handle device data from IoT devices
   */
  handleDeviceData(ws, payload) {
    try {
      const connectionInfo = this.clients.get(ws);
      if (!connectionInfo) return;

      // This would handle real-time data submission from devices
      // For now, we'll just acknowledge receipt
      this.sendToClient(ws, {
        type: 'data_received',
        timestamp: new Date(),
        messageId: payload.messageId
      });

    } catch (error) {
      logger.error('WebSocket device data handling error:', error);
    }
  }

  /**
   * Handle WebSocket disconnection
   */
  handleDisconnection(ws) {
    try {
      const connectionInfo = this.clients.get(ws);
      if (!connectionInfo) return;

      // Remove from user connections
      if (connectionInfo.user) {
        const userConns = this.userConnections.get(connectionInfo.user.userId);
        if (userConns) {
          userConns.delete(ws);
          if (userConns.size === 0) {
            this.userConnections.delete(connectionInfo.user.userId);
          }
        }
      }

      // Remove from device subscriptions
      connectionInfo.subscriptions.forEach(subscription => {
        if (subscription.startsWith('device:')) {
          const deviceId = subscription.split(':')[1];
          const deviceSubs = this.deviceSubscriptions.get(deviceId);
          if (deviceSubs) {
            deviceSubs.delete(ws);
            if (deviceSubs.size === 0) {
              this.deviceSubscriptions.delete(deviceId);
            }
          }
        }
      });

      this.clients.delete(ws);
      logger.info(`WebSocket connection closed: ${connectionInfo.id}`);

    } catch (error) {
      logger.error('WebSocket disconnection error:', error);
    }
  }

  /**
   * Handle WebSocket errors
   */
  handleError(error) {
    logger.error('WebSocket server error:', error);
  }

  /**
   * Handle pong response for heartbeat
   */
  handlePong(ws) {
    const connectionInfo = this.clients.get(ws);
    if (connectionInfo) {
      connectionInfo.isAlive = true;
      connectionInfo.lastPing = Date.now();
    }
  }

  /**
   * Start heartbeat to detect dead connections
   */
  startHeartbeat() {
    setInterval(() => {
      this.clients.forEach((connectionInfo, ws) => {
        if (!connectionInfo.isAlive) {
          ws.terminate();
          return;
        }

        connectionInfo.isAlive = false;
        ws.ping();
      });
    }, 30000); // 30 seconds
  }

  /**
   * Send message to specific client
   */
  sendToClient(ws, data) {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
      }
    } catch (error) {
      logger.error('Failed to send message to WebSocket client:', error);
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(data, filter = null) {
    this.clients.forEach((connectionInfo, ws) => {
      if (filter && !filter(connectionInfo)) return;
      this.sendToClient(ws, data);
    });
  }

  /**
   * Send message to specific user
   */
  sendToUser(userId, data) {
    const userConnections = this.userConnections.get(userId);
    if (userConnections) {
      userConnections.forEach(ws => {
        this.sendToClient(ws, data);
      });
    }
  }

  /**
   * Send message to subscribers of specific device
   */
  sendToDeviceSubscribers(deviceId, data) {
    const deviceSubs = this.deviceSubscriptions.get(deviceId);
    if (deviceSubs) {
      deviceSubs.forEach(ws => {
        this.sendToClient(ws, data);
      });
    }
  }

  /**
   * Send real-time data update
   */
  sendDataUpdate(deviceId, data) {
    this.sendToDeviceSubscribers(deviceId, {
      type: 'data_update',
      deviceId,
      data,
      timestamp: new Date()
    });
  }

  /**
   * Send device status update
   */
  sendDeviceStatusUpdate(deviceId, status) {
    this.sendToDeviceSubscribers(deviceId, {
      type: 'device_status',
      deviceId,
      status,
      timestamp: new Date()
    });
  }

  /**
   * Send alert to user
   */
  sendAlert(userId, alert) {
    this.sendToUser(userId, {
      type: 'alert',
      alert,
      timestamp: new Date()
    });
  }

  /**
   * Generate unique client ID
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get server statistics
   */
  getStats() {
    return {
      totalConnections: this.clients.size,
      userConnections: this.userConnections.size,
      deviceSubscriptions: this.deviceSubscriptions.size,
      connections: Array.from(this.clients.values()).map(conn => ({
        id: conn.id,
        userId: conn.user?.userId,
        connectedAt: conn.connectedAt,
        subscriptions: Array.from(conn.subscriptions)
      }))
    };
  }
}

// Singleton instance
let websocketServiceInstance = null;

const getWebSocketService = () => {
  if (!websocketServiceInstance) {
    websocketServiceInstance = new WebSocketService();
  }
  return websocketServiceInstance;
};

module.exports = {
  WebSocketService,
  getWebSocketService
};