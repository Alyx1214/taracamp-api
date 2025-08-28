import React from 'react';
import styles from './AuthFormContainer.module.css';

function AuthFormContainer({ children }) {
  return <div className={styles.formContainer}>{children}</div>;
}

export default AuthFormContainer;

