import { api } from '@/lib/api';

export interface CommandRecord {
  id: string;
  lockDevice?: {
    _id?: string;
    name?: string;
    lockId?: string;
    walletAddress?: string;
    isApproved?: boolean;
    status?: string;
  };
  lockAddress: string;
  submittedBy?: {
    _id?: string;
    email?: string;
    role?: string;
    profile?: {
      firstName?: string;
      lastName?: string;
    };
  };
  submittedByAddress: string;
  commandType: 'LOCK' | 'UNLOCK';
  rawPayload?: Record<string, unknown> | null;
  nonce: string;
  expiresAt: string;
  submittedAt: string;
  status: 'pending' | 'executed' | 'failed' | 'expired' | 'cancelled';
  executionResult?: string;
  executedAt?: string;
  executedByLockAddress?: string;
  blockchainCommandId?: number;
  blockchainTxHash?: string;
  blockNumber?: number;
  blockTimestamp?: string;
  executionSyncedOnChain?: boolean;
  onChainExecutionTxHash?: string;
  onChainExecutionBlockNumber?: number;
  onChainExecutionBlockTimestamp?: string;
  processingStatus: 'pending' | 'processed' | 'error';
  processingError?: string;
  encryption?: {
    payloadAlgorithm?: string;
    keyMode?: string;
    keyReference?: string;
  };
  cryptoDebug?: {
    encryptedPayload?: string;
    encryptedSessionKey?: string;
    iv?: string;
    authTag?: string;
  };
  metadata?: {
    source?: string;
    ipAddress?: string;
    userAgent?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface CommandListResponse {
  success: boolean;
  data: CommandRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface CreateCommandPayload {
  lockAddress: string;
  commandType: 'LOCK' | 'UNLOCK';
  submittedByAddress: string;
  expiresInSeconds?: number;
  metadata?: {
    source?: string;
  };
}

export const dataService = {
  async getAllData(params?: {
    page?: number;
    limit?: number;
    lockAddress?: string;
    status?: string;
    commandType?: string;
  }): Promise<CommandListResponse> {
    const response = await api.get('/commands', { params });
    return response.data;
  },

  async getDataById(commandId: string): Promise<CommandRecord> {
    const response = await api.get(`/commands/${commandId}`);
    return response.data.data;
  },

  async getDataHistory(lockAddress: string, params?: {
    page?: number;
    limit?: number;
  }): Promise<CommandListResponse> {
    const response = await api.get(`/commands/history/${lockAddress}`, { params });
    return {
      success: response.data.success,
      data: response.data.data,
      pagination: response.data.pagination,
    };
  },

  async createCommand(payload: CreateCommandPayload) {
    const response = await api.post('/commands/encrypt-and-submit', payload);
    return response.data;
  },
};
