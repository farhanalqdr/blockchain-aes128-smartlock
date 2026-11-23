import { api } from '@/lib/api';

export interface LockDevice {
  id: string;
  name: string;
  lockId: string;
  walletAddress: string;
  publicKeyFingerprint?: string | null;
  isApproved: boolean;
  isOnline?: boolean;
  status: string;
  blockchainTxHash?: string;
  registeredAt: string;
  lastSeenAt?: string;
  lastCommandAt?: string;
  lastCommandStatus?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LockListResponse {
  success: boolean;
  data: LockDevice[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface RegisterLockPayload {
  name: string;
  lockId: string;
  walletAddress: string;
}

export const deviceService = {
  async getDevices(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }): Promise<LockListResponse> {
    const response = await api.get('/locks', { params });
    return response.data;
  },

  async getDevice(deviceId: string): Promise<{ success: boolean; data: LockDevice }> {
    const response = await api.get(`/locks/${deviceId}`);
    return response.data;
  },

  async approveDevice(walletAddress: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post(`/locks/approve/${walletAddress}`);
    return response.data;
  },

  async rejectDevice(walletAddress: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post(`/locks/reject/${walletAddress}`);
    return response.data;
  },

  async registerDevice(payload: RegisterLockPayload): Promise<{ success: boolean; message: string; lock: LockDevice }> {
    const response = await api.post('/locks', payload);
    return response.data;
  },

  async getAllDevices(): Promise<LockDevice[]> {
    const response = await api.get('/locks', { params: { page: 1, limit: 100 } });
    return response.data.data;
  },
};