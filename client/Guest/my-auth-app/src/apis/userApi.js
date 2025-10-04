import { apiPost } from './api';

export function register({ email, firstName, lastName, password }) {
  return apiPost('/user/register', { email, firstName, lastName, password });
}
export function login({ email, password }) {
  return apiPost('/user/login', { email, password });
}
export function googleLogin({ code, redirectUri }) {
  return apiPost('/user/google-login', { code, redirectUri });
}
export function facebookLogin({ token }) {
  return apiPost('/user/facebook-login', { token });
}

export function logout() {
  return apiPost('/user/logout');
}

export function forgotPassword({ email }, token) {
  return apiPost('/user/send-password-reset-verification-code', { email }, {
    headers: { Authorization: `Bearer ${token}` }
  });
}
