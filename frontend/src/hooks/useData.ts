import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dataService, type CreateCommandPayload } from '@/services/dataService';

export const useLatestData = (lockAddress: string) => {
  return useQuery({
    queryKey: ['commandHistoryLatest', lockAddress],
    queryFn: async () => {
      const result = await dataService.getDataHistory(lockAddress, { page: 1, limit: 1 });
      return result.data[0] ?? null;
    },
    enabled: !!lockAddress,
  });
};

export const useDataHistory = (lockAddress: string, params?: {
  page?: number;
  limit?: number;
}) => {
  return useQuery({
    queryKey: ['commandHistory', lockAddress, params],
    queryFn: () => dataService.getDataHistory(lockAddress, params),
    enabled: !!lockAddress,
  });
};

export const useAllData = (params?: { page?: number; limit?: number; lockAddress?: string; status?: string; commandType?: string }) => {
  return useQuery({
    queryKey: ['commands', params],
    queryFn: () => dataService.getAllData(params),
  });
};

export const useCreateCommand = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateCommandPayload) => dataService.createCommand(payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['commands'] });
      queryClient.invalidateQueries({ queryKey: ['commandHistory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['locks'] });
      if (variables.lockAddress) {
        queryClient.invalidateQueries({ queryKey: ['commandHistory', variables.lockAddress] });
      }
    },
  });
};
