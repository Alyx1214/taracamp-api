import React from 'react';
import styles from './AuthFormContainer.module.css';

function AuthFormContainer({ children, leftContent, rightContent }) {
  // If rightContent is provided, render only the right panel content
  // (left panel is handled by AuthSidePanel in the parent component)
  if (rightContent) {
    return (
      <div className={styles.formContainer}>
        {rightContent}
      </div>
    );
  }
  
  // Otherwise, render the single panel layout (existing behavior)
  return (
    <div className={styles.formContainer}>
      {children}
    </div>
  );
}

export default AuthFormContainer;