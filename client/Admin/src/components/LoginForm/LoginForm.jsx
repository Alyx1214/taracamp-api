import React, { useState } from 'react';
import styles from '../AuthFormContainer/AuthFormContainer.module.css';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { login as apiLogin } from '../../apis/userApi.js';
import { persistAuth } from '../../utils/auth';

function LoginForm({ onForgotPassword, onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
 

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await apiLogin({ email, password });
      const role = String(data?.role || '').toUpperCase();
      if (role === 'Guest') {
        setError('Guest accounts cannot access the Admin portal.');
        return; 
      }
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
        <div className={styles.passwordWrap}>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            className={`${styles.formInput} ${styles.formInputWithToggle}`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <span
            className={styles.toggleIcon}
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
      
    </div>
  );
}

export default LoginForm;
