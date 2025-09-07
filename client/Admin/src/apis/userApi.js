import { apiGet, apiPost } from './api';

export function login({ email, password }) {
  return apiPost('/user/login', { email, password });
}

export function logout() {
  return apiPost('/user/logout');
}

export function getUsersByRole(role) {
  if (!role) throw new Error('role is required');
  return apiGet(`/user/get-all-users-by-role/${encodeURIComponent(role)}`);
}

export function searchUsers(query = {}) {
  return apiGet('/user/search-users', query);
}
