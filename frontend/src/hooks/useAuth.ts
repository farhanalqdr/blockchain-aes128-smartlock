import { useMutation } from '@tanstack/react-query';
import { authService } from '@/services/authService';
import type { LoginCredentials, RegisterData } from '@/services/authService';

export const useLogin = () => {
  return useMutation({
    mutationFn: (credentials: LoginCredentials) => authService.login(credentials),
    onSuccess: (data) => {
      localStorage.setItem('auth_token', data.token);
      window.location.href = '/';
    },
  });
};

export const useRegister = () => {
  return useMutation({
    mutationFn: (userData: RegisterData) => authService.register(userData),
    onSuccess: (data) => {
      localStorage.setItem('auth_token', data.token);
      window.location.href = '/';
    },
  });
};

export const useLogout = () => {
  return () => {
    authService.logout();
  };
};
