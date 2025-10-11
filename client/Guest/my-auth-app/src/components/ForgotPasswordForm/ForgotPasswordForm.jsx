import React, { useEffect, useState } from 'react';
import commonStyles from '../AuthFormContainer/AuthFormContainer.module.css';
import styles from './ForgotPasswordForm.module.css'; 
import { forgotPassword } from '../../apis/userApi';

function ForgotPasswordForm({ onBackToLogin, onCodeSent, initialEmail = '' }) {
  const [email, setEmail] = useState(initialEmail);
  const [message, setMessage] = useState(''); 
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setEmail(initialEmail || '');
  }, [initialEmail]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(''); 

    if (!email) {
      setMessage('Please enter your email address.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await forgotPassword({ email });
      setMessage(res?.message || 'If an account with that email exists, a password reset link has been sent.');
      onCodeSent?.(email);
    } catch (error) {
      setMessage(error?.data?.error || error?.message || 'Failed to send reset email.');
    } finally {
      setSubmitting(false);
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
        <button type="submit" className={commonStyles.formButton} disabled={submitting}>
          {submitting ? 'Sending...' : 'Send Reset Code'}
        </button>
      </form>
    </div>
  );
}

export default ForgotPasswordForm;
