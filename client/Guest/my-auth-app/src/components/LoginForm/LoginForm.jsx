import React, { useState } from 'react';
import styles from '../AuthFormContainer/AuthFormContainer.module.css';
import loginStyles from './LoginForm.module.css';
import { FaGoogle, FaFacebook, FaEye, FaEyeSlash } from 'react-icons/fa';
import { useGoogleLogin } from '@react-oauth/google';
import { useFacebookLogin } from '@kazion/react-facebook-login';
import { login as apiLogin, googleLogin as apiGoogleLogin, facebookLogin as apiFacebookLogin } from '../../apis/userApi.js';
import { persistAuth } from '../../utils/auth';

function LoginForm({ onForgotPassword, onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [facebookLoading, setFacebookLoading] = useState(false);
  const [facebookError, setFacebookError] = useState(null);

  const googleRedirectUri = import.meta.env.VITE_GOOGLE_REDIRECT_URI || window.location.origin;

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (codeResponse) => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGoogleLogin({ code: codeResponse.code, redirectUri: googleRedirectUri });
        persistAuth(data);
        onLoginSuccess();
      } catch (err) {
        setError(err?.data?.error || 'Google login failed. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    onError: () => setError('Google login failed. Please try again.'),
    flow: 'auth-code',
    redirect_uri: googleRedirectUri,
  });

  const fbLogin = useFacebookLogin({
    scope: 'public_profile,email',
    onSuccess: async (response) => {
      setFacebookLoading(true);
      setFacebookError(null);
      try {
        const accessToken = response.authResponse.accessToken;
        const data = await apiFacebookLogin({ token: accessToken });
        persistAuth(data);
        onLoginSuccess();
      } catch (err) {
        setFacebookError(err?.data?.error || 'Facebook login failed. Please try again.');
      } finally {
        setFacebookLoading(false);
      }
    },
    onFailure: (err) => {
      console.error('FB login error:', err);
      setFacebookError('Facebook login cancelled or failed.');
      setFacebookLoading(false);
    },
  });

  const handleFacebookLogin = async () => {
    setFacebookLoading(true);
    setFacebookError(null);
    try {
      await fbLogin();
    } catch (err) {
      console.error('Network error:', err);
      setFacebookError('An unexpected error occurred. Please try again later.');
      setFacebookLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await apiLogin({ email, password });
      persistAuth(data);
      onLoginSuccess();
    } catch (err) {
      setError(err?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.formGroup}>
      <h2>Log in</h2>
      <p>Let us explore the possibilities that Teachers Camp have!</p>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          className={styles.formInput}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <div className={loginStyles.passwordInputWrapper}>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            className={`${styles.formInput} ${loginStyles.passwordInput}`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <span
            className={loginStyles.passwordToggle}
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </span>
        </div>
        <div className={loginStyles.forgotPasswordContainer}>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onForgotPassword();
            }}
            className={loginStyles.forgotPasswordLink}
          >
            Forgot Password?
          </a>
        </div>
        <button type="submit" className={styles.formButton} disabled={loading}>
          Log In
        </button>
      </form>
      {loading && <p>Logging in...</p>}
      {error && <p className={loginStyles.errorMessage}>{error}</p>}
      {facebookLoading && <p>Logging in with Facebook...</p>}
      {facebookError && <p className={loginStyles.errorMessage}>{facebookError}</p>}
      <p className={styles.orSeparator}>or</p>
      <div className={styles.socialLogin}>
        <button
          onClick={handleFacebookLogin}
          className={styles.socialButton}
          aria-label="Login with Facebook"
          disabled={facebookLoading}
        >
          <FaFacebook style={{ color: '#1877F2' }} />
        </button>
        <button
          onClick={() => handleGoogleLogin()}
          className={styles.socialButton}
          aria-label="Login with Google"
        >
          <FaGoogle style={{ color: '#DB4437' }} />
        </button>
      </div>
    </div>
  );
}

export default LoginForm;