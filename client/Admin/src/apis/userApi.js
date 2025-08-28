import { apiPost } from './api';

export function login({ email, password }) {
  return apiPost('/api/user/login', { email, password });
}

export function logout() {
  return apiPost('/api/user/logout');
}
