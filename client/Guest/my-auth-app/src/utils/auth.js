const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';
const USER_ID_KEY = 'userId';
const ROLE_KEY = 'userRole';
const USER_NAME_KEY = 'userName';

export function persistAuth({ accessToken, refreshToken, userId, role, name }) {
  if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  if (userId) localStorage.setItem(USER_ID_KEY, userId);
  if (role) {
    const normalized = String(role).trim().toUpperCase();
    localStorage.setItem(ROLE_KEY, normalized);
  }
  if (name) {
    localStorage.setItem(USER_NAME_KEY, name);
  }
}

export function getUserName() {
  return localStorage.getItem(USER_NAME_KEY) || null;
}
