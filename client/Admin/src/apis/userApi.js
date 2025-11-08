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

export function addUser({ name, email, role, password }) {
  return apiPost('/user/add-user', { name, email, role, password });
}

export function updateUser(userId, { name, email, role, password }) {
  if (!userId) throw new Error('userId is required');
  return apiPost(`/user/update-user/${encodeURIComponent(userId)}`, { name, email, role, password });
}

export function deleteUser(userId) {
  if (!userId) throw new Error('userId is required');
  return apiPost(`/user/delete-user/${encodeURIComponent(userId)}`);
}
