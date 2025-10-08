import React, { useState } from 'react';
import AuthFormContainer from '../AuthFormContainer/AuthFormContainer';
import './ResetPassword.module.css';

const ResetPassword = () => {
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Handle password reset logic here
    console.log('Reset password data:', formData);
  };

  const leftPanelContent = (
    <div className="reset-password-left-panel">
      <h2>Baguio Teachers Camp</h2>
      <div className="reset-password-info">
        <p>Ready to log in? <em>Create your new password now and you'll be all set.</em></p>
        <p className="optional-text">(Optional: Change the "Log In" button to say "Back to Login".)</p>
      </div>
    </div>
  );

  const rightPanelContent = (
    <div className="reset-password-form">
      <h2>Create a New Password</h2>
      <p className="form-description">
        Enter and confirm your new password below. Make sure it's strong and unique.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <input
            type="password"
            name="newPassword"
            placeholder="New Password"
            value={formData.newPassword}
            onChange={handleInputChange}
            required
          />
        </div>
        <div className="input-group">
          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirm Password"
            value={formData.confirmPassword}
            onChange={handleInputChange}
            required
          />
        </div>
        <button type="submit" className="reset-password-btn">
          Set New Password
        </button>
      </form>
    </div>
  );

  return (
    <AuthFormContainer
      leftContent={leftPanelContent}
      rightContent={rightPanelContent}
    />
  );
};

export default ResetPassword;