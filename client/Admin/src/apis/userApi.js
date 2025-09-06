import { apiPost } from './api';

export function login({ email, password }) {
  return apiPost('/user/login', { email, password });
}

export function logout() {
  return apiPost('/user/logout');
}
