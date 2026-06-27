import { api } from './client';

export interface AuthResponse {
  token: string;
  teacher: {
    id: string;
    name: string;
    email: string;
  };
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  password: string;
}

export const authApi = {
  register: (payload: RegisterPayload) =>
    api.post<AuthResponse>('/auth/register', payload),

  login: (payload: LoginPayload) =>
    api.post<AuthResponse>('/auth/login', payload),

  forgotPassword: (payload: ForgotPasswordPayload) =>
    api.post<{ message: string }>('/auth/forgot-password', payload),

  resetPassword: (token: string, payload: ResetPasswordPayload) =>
    api.post<{ message: string }>(`/auth/reset-password/${token}`, payload),
};
