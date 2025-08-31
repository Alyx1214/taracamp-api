// src/api/userApi.js
import { apiPost } from './api';

export function register({ email, firstName, lastName, password }) {
  return apiPost('/api/user/register', { email, firstName, lastName, password });
}

export function login({ email, password }) {
  return apiPost('/api/user/login', { email, password });
}

export function googleLogin({ code }) {
  return apiPost('/api/user/google-login', { code });
}

export function facebookLogin({ token }) {
  return apiPost('/api/user/facebook-login', { token });
}

// add more user-related endpoints as needed:
// export function register(payload) { ... }
// export function forgotPassword(email) { ... }
