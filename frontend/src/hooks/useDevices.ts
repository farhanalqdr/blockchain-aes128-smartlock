import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deviceService, type RegisterLockPayload } from '@/services/deviceService';

export const useDevices = (params?: { page?: number; limit?: number; status?: string; search?: string }) => {
  return useQuery({
    queryKey: ['locks', params],
    queryFn: () => deviceService.getDevices(params),
  });
};

export const useDevice = (deviceId: string) => {
  return useQuery({
    queryKey: ['lock', deviceId],
    queryFn: () => deviceService.getDevice(deviceId),
    enabled: !!deviceId,
  });
};

export const useApproveDevice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (walletAddress: string) => deviceService.approveDevice(walletAddress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locks'] });
      queryClient.invalidateQueries({ queryKey: ['lock'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const useRejectDevice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (walletAddress: string) => deviceService.rejectDevice(walletAddress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locks'] });
      queryClient.invalidateQueries({ queryKey: ['lock'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const useRegisterDevice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RegisterLockPayload) => deviceService.registerDevice(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const useAllDevices = () => {
  return useQuery({
    queryKey: ['allLocks'],
    queryFn: () => deviceService.getAllDevices(),
  });
};
