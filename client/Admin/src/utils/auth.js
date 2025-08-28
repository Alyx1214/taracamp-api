const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';
const USER_ID_KEY = 'userId';
const ROLE_KEY = 'userRole';

export function persistAuth({ accessToken, refreshToken, userId, role }) {
  if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  if (userId) localStorage.setItem(USER_ID_KEY, userId);
  if (role) localStorage.setItem(ROLE_KEY, role);
}

