import React from 'react';
import styles from './AuthSidePanel.module.css';
import mountainLogo from '../../assets/logo.png'; 

function AuthSidePanel({ isLogin, isForgotPassword, onToggleForm }) {
  return (
    <div className={styles.sidePanel}>
      <div className={styles.logoContainer}>
        <img src={mountainLogo} alt="Baguio Teachers Camp Logo" className={styles.logo} />
        <p className={styles.logoText}>Baguio Teachers Camp</p>
      </div>
      <div className={styles.textContent}>
        {isLogin ? (
          <>
            <h2 className={styles.welcomeHeading}>Welcome Back!</h2>
            <p>Your Next Adventure Awaits!</p>
          </>
        ) : isForgotPassword ? ( 
          <>
            <h2>Need help with your password?</h2>
            <p>We're here to assist you.</p>
            <p className={styles.promptText}>Remembered your password?</p>
            <button className={styles.toggleButton} onClick={() => onToggleForm('login')}>Log In</button>
          </>
        ) : (
          <>
            <h2>Join Us & <br/> Unlock the Best Experience!</h2>
            <p className={styles.promptText}>Already have an Account?</p>
            <button className={styles.toggleButton} onClick={() => onToggleForm('login')}>Log In</button>
          </>
        )}
      </div>
    </div>
  );
}

export default AuthSidePanel;
