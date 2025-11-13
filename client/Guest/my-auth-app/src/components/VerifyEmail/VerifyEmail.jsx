import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { verifyEmail, resendVerificationEmail } from '../../apis/userApi';
import AuthFormContainer from '../AuthFormContainer/AuthFormContainer';
import styles from './VerifyEmail.module.css';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'error', 'expired'
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    const emailParam = searchParams.get('email');

    if (!token || !emailParam) {
      setStatus('error');
      setMessage('Invalid verification link. Please check your email for the correct link.');
      return;
    }

    setEmail(emailParam);
    verifyEmailAddress(emailParam, token);
  }, [searchParams]);

  const verifyEmailAddress = async (email, token) => {
    try {
      const res = await verifyEmail({ email, token });
      if (res.status === 200) {
        setStatus('success');
        setMessage(res.message || 'Email verified successfully! You can now log in.');
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/auth/login');
        }, 3000);
      } else {
        if (res.error?.includes('expired')) {
          setStatus('expired');
        } else {
          setStatus('error');
        }
        setMessage(res.error || 'Failed to verify email. Please try again.');
      }
    } catch (err) {
      setStatus('error');
      setMessage(err?.data?.error || err?.message || 'An error occurred. Please try again.');
    }
  };

  const handleResend = async () => {
    if (!email || resending) return;
    
    setResending(true);
    try {
      const res = await resendVerificationEmail({ email });
      if (res.status === 200) {
        setMessage('A new verification email has been sent. Please check your inbox.');
        setStatus('error'); // Change to show resend success message
      } else {
        setMessage(res.error || 'Failed to resend verification email.');
      }
    } catch (err) {
      setMessage(err?.data?.error || err?.message || 'Failed to resend verification email.');
    } finally {
      setResending(false);
    }
  };

  const rightPanelContent = (
    <div className={styles.verifyForm}>
      <h2>Verify Your Email</h2>

      {status === 'verifying' && (
        <div className={styles.message}>
          <p>Verifying your email address...</p>
        </div>
      )}

      {status === 'success' && (
        <div className={`${styles.message} ${styles.success}`}>
          <p>{message}</p>
          <p className={styles.redirectHint}>Redirecting to login page...</p>
        </div>
      )}

      {(status === 'error' || status === 'expired') && (
        <>
          <div className={`${styles.message} ${styles.error}`}>
            <p>{message}</p>
          </div>
          
          {status === 'expired' && (
            <div className={styles.resendSection}>
              <p>Your verification link has expired. Would you like us to send a new one?</p>
              <button
                type="button"
                onClick={handleResend}
                className={styles.resendBtn}
                disabled={resending}
              >
                {resending ? 'Sending...' : 'Resend Verification Email'}
              </button>
            </div>
          )}

          {status === 'error' && !message.includes('new verification email') && (
            <div className={styles.resendSection}>
              <p>Need a new verification email?</p>
              <button
                type="button"
                onClick={handleResend}
                className={styles.resendBtn}
                disabled={resending}
              >
                {resending ? 'Sending...' : 'Resend Verification Email'}
              </button>
            </div>
          )}

          <div className={styles.actionButtons}>
            <button
              type="button"
              onClick={() => navigate('/auth/login')}
              className={styles.loginBtn}
            >
              Go to Login
            </button>
          </div>
        </>
      )}
    </div>
  );

  return <AuthFormContainer rightContent={rightPanelContent} />;
};

export default VerifyEmail;

