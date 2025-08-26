import React, { useState } from 'react';
import styles from '../AuthFormContainer/AuthFormContainer.module.css';
import { FaGoogle, FaFacebook, FaEye, FaEyeSlash } from 'react-icons/fa';
import { useGoogleLogin } from '@react-oauth/google';
import { useFacebookLogin } from '@kazion/react-facebook-login';

function LoginForm({ onForgotPassword, onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [facebookLoading, setFacebookLoading] = useState(false);
  const [facebookError, setFacebookError] = useState(null);

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (codeResponse) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(VITE_API_URL + '/user/google-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: codeResponse.code }),
        });
        const data = await response.json();
        if (response.ok) {
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken); 
          localStorage.setItem('userId', data.userId);
          localStorage.setItem('userRole', data.role);
          onLoginSuccess();
        } else {
          setError(data.error || 'Google login failed. Please try again.');
        }
      } catch (err) {
        setError('An unexpected error occurred. Please try again later.');
      } finally {
        setLoading(false);
      }
    },
    onError: () => setError('Google login failed. Please try again.'),
    flow: 'auth-code',
  });

  const facebookLogin = useFacebookLogin({
    scope: 'public_profile,email',
    onSuccess: async (response) => {
      setFacebookLoading(true);
      setFacebookError(null);
      try {
        const accessToken = response.authResponse.accessToken;
        const apiRes = await fetch(VITE_API_URL + '/user/facebook-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: accessToken }),
        });
        const data = await apiRes.json();
        if (apiRes.ok) {
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('userId', data.userId);
          localStorage.setItem('userRole', data.role);
          onLoginSuccess();
        } else {
          setFacebookError(data.error || 'Facebook login failed. Please try again.');
        }
      } catch (err) {
        setFacebookError('An unexpected error occurred during Facebook login.');
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
      await facebookLogin();
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
      const response = await fetch(VITE_API_URL + '/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        localStorage.setItem('userId', data.userId);
        localStorage.setItem('userRole', data.role);
        onLoginSuccess();
      } else {
        setError(data.error || 'Login failed. Please try again.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again later.');
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
        <div style={{ position: 'relative', marginBottom: '20px' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            className={styles.formInput}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ marginBottom: 0 }}
          />
          <span
            style={{
              position: 'absolute',
              right: '15px',
              top: '50%',
              transform: 'translateY(-50%)',
              cursor: 'pointer',
              color: '#666',
              fontSize: '1.1em',
            }}
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onForgotPassword();
            }}
            style={{ fontSize: '0.9em', color: '#1E3C24', textDecoration: 'none' }}
          >
            Forgot Password?
          </a>
        </div>
        <button type="submit" className={styles.formButton} disabled={loading}>
          Log In
        </button>
      </form>
      {loading && <p>Logging in...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {facebookLoading && <p>Logging in with Facebook...</p>}
      {facebookError && <p style={{ color: 'red' }}>{facebookError}</p>}
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
