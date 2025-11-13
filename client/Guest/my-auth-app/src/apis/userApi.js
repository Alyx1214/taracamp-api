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

export function forgotPassword({ email }) {
  return apiPost('/user/send-password-reset-verification-code', { email });
}

export function verifyPasswordResetCode({ email, verificationCode }) {
  return apiPost('/user/verify-password-reset-code', { email, verificationCode });
}

export function resetPassword({ email, newPassword, resetToken }) {
  return apiPost('/user/reset-password', { email, newPassword, resetToken });
}

export function verifyEmail({ email, token }) {
  return apiPost('/user/verify-email', { email, token });
}

export function resendVerificationEmail({ email }) {
  return apiPost('/user/resend-verification-email', { email });
}
