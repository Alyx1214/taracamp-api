import React, { useEffect, useRef, useState } from 'react';
import AuthFormContainer from '../AuthFormContainer/AuthFormContainer';
import styles from './ResetPassword.module.css';
import { resetPassword as resetPasswordApi } from '../../apis/userApi';

const ResetPassword = ({ email, resetToken, onBackToLogin, onResetComplete }) => {
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !resetToken) {
      setMessage({ type: 'error', text: 'We lost your reset session. Please start over.' });
      return;
    }
    if (!formData.newPassword || !formData.confirmPassword) {
      setMessage({ type: 'error', text: 'Please fill out both password fields.' });
      return;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await resetPasswordApi({
        email,
        newPassword: formData.newPassword,
        resetToken,
      });
      setMessage({ type: 'success', text: res?.message || 'Password reset successfully.' });
      setFormData({ newPassword: '', confirmPassword: '' });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        onResetComplete?.();
      }, 1200);
    } catch (error) {
      setMessage({ type: 'error', text: error?.data?.error || error?.message || 'Failed to reset password.' });
    } finally {
      setSubmitting(false);
    }
  };

  const rightPanelContent = (
    <div className={styles.resetPasswordForm}>
      <h2>Create a New Password</h2>
      <p className={styles.formDescription}>
        Enter and confirm your new password below. Make sure it's strong and unique.
      </p>
      {email ? (
        <p className={styles.emailHint}>Resetting password for <strong>{email}</strong></p>
      ) : (
        <p className={styles.emailHint}>Start over to request a new reset link.</p>
      )}
      {message.text ? (
        <div
          className={[
            styles.message,
            message.type === 'success' ? styles.success : styles.error,
          ].join(' ')}
        >
          {message.text}
        </div>
      ) : null}
      <form onSubmit={handleSubmit}>
        <div className={styles.inputGroup}>
          <input
            type="password"
            name="newPassword"
            placeholder="New Password"
            value={formData.newPassword}
            onChange={handleInputChange}
            required
            disabled={submitting}
          />
        </div>
        <div className={styles.inputGroup}>
          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirm Password"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            required
            disabled={submitting}
          />
        </div>
        <button type="submit" className={styles.resetPasswordBtn} disabled={submitting || !email || !resetToken}>
          {submitting ? 'Setting Password...' : 'Set New Password'}
        </button>
      </form>
      <button
        type="button"
        className={styles.secondaryLink}
        onClick={() => {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          onBackToLogin?.();
        }}
        disabled={submitting}
      >
        Back to Login
      </button>
    </div>
  );

  return (
    <AuthFormContainer rightContent={rightPanelContent} />
  );
};

export default ResetPassword;
