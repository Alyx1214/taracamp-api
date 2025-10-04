import React, { useState } from 'react';
import commonStyles from '../AuthFormContainer/AuthFormContainer.module.css';
import styles from './ForgotPasswordForm.module.css'; 
import { forgotPassword } from '../../apis/userApi';

function ForgotPasswordForm({ onBackToLogin }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(''); 

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(''); 

    if (!email) {
      setMessage('Please enter your email address.');
      return;
    }

  try {
      const res = await forgotPassword({ email });
      setMessage(res?.message || 'If an account with that email exists, a password reset link has been sent.');
    } catch (error) {
      setMessage(error?.message || 'Failed to send reset email.');
    }
  };

  return (
    <div className={commonStyles.formGroup}> 
      <h2>Forgot Password?</h2>
      <p>Enter your email and we'll send you a link to reset your password.</p>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          className={commonStyles.formInput} 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {message && <p className={styles.message}>{message}</p>} 
        <button type="submit" className={commonStyles.formButton}>
          Send Reset Link
        </button>
      </form>
    </div>
  );
}

export default ForgotPasswordForm;