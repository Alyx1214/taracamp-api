import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import commonStyles from '../AuthFormContainer/AuthFormContainer.module.css';
import specificStyles from './SignUpForm.module.css';
import { FaFacebook, FaGoogle, FaEye, FaEyeSlash } from 'react-icons/fa';
import { useGoogleLogin } from '@react-oauth/google';
import { useFacebookLogin } from '@kazion/react-facebook-login';
import Terms from '../Terms/Terms';

import { register as apiRegister, googleLogin as apiGoogleLogin, facebookLogin as apiFacebookLogin, } from '../../apis/userApi';
import { persistAuth } from '../../utils/auth';

function SignUpForm({ onRegistrationSuccess }) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [facebookLoading, setFacebookLoading] = useState(false);
  const [facebookError, setFacebookError] = useState(null);

  const navigate = useNavigate();
  const API = import.meta.env.VITE_API_URL;

  const handleRegistrationSuccess = () => {
    if (onRegistrationSuccess) onRegistrationSuccess();
    else navigate('/auth/login');
  };

  const googleRedirectUri = import.meta.env.VITE_GOOGLE_REDIRECT_URI || window.location.origin;

  // Google OAuth (auth code flow)
  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (codeResponse) => {
      setLoading(true);
      setError(null);
      try {
        // IMPORTANT: backend expects { code }, not { token }
        const data = await apiGoogleLogin({ code: codeResponse.code, redirectUri: googleRedirectUri });
        // Social signups usually log you in right away
        persistAuth(data);
        navigate('/homepage');
      } catch (err) {
        setError(err?.data?.error || 'Google login failed. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    onError: () => setError('Google login failed. Please try again.'),
    flow: 'auth-code',
    redirect_uri: googleRedirectUri,
  });

  // Facebook OAuth
  const fbLogin = useFacebookLogin({
    scope: 'public_profile,email',
    onSuccess: async (response) => {
      setFacebookLoading(true);
      setFacebookError(null);
      try {
        const accessToken = response.authResponse?.accessToken;
        const data = await apiFacebookLogin({ token: accessToken });
        persistAuth(data);
        navigate('/homepage');
      } catch (err) {
        setFacebookError(err?.data?.error || 'Facebook login failed. Please try again.');
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
      await fbLogin();
    } catch (err) {
      console.error('Network error:', err);
      setFacebookError('An unexpected error occurred. Please try again later.');
      setFacebookLoading(false);
    }
  };

  // Email/password signup
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match!");
      setLoading(false);
      return;
    }
    if (!agreedToTerms) {
      setError('You must agree to the Terms and Privacy Policy.');
      setLoading(false);
      return;
    }

    try {
      await apiRegister({ email, firstName, lastName, password });
      handleRegistrationSuccess();
    } catch (err) {
      console.error('Registration failed:', err);
      setError(err?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${commonStyles.formGroup} ${specificStyles.signUpFormGroup}`}>
      <h2 className={specificStyles.signUpFormGroup}>Create an Account</h2>
      <p className={specificStyles.signUpDescription}>
        Join and Explore the possibilities that Teachers Camp have!
      </p>

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          className={`${commonStyles.formInput} ${specificStyles.signUpFormInput}`}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <div className={specificStyles.nameInputContainer}>
          <input
            type="text"
            placeholder="First Name"
            className={`${commonStyles.formInput} ${specificStyles.signUpFormInput} ${specificStyles.nameInput}`}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Last Name"
            className={`${commonStyles.formInput} ${specificStyles.signUpFormInput} ${specificStyles.nameInput}`}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>

        <div className={specificStyles.passwordInputWrapper}>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            className={`${commonStyles.formInput} ${specificStyles.signUpFormInput} ${specificStyles.passwordInput}`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <span
            className={specificStyles.passwordToggle}
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </span>
        </div>

        <div className={specificStyles.confirmPasswordWrapper}>
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="Confirm Password"
            className={`${commonStyles.formInput} ${specificStyles.signUpFormInput} ${specificStyles.confirmPasswordInput}`}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <span
            className={specificStyles.passwordToggle}
            onClick={() => setShowConfirmPassword((v) => !v)}
            aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
          >
            {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
          </span>
        </div>

        <div className={specificStyles.termsContainer}>
          <input
            type="checkbox"
            id="terms"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className={specificStyles.termsCheckbox}
          />
          <label htmlFor="terms" className={`${commonStyles.formGroup} ${specificStyles.termsLabel}`}>
            I agree to the{' '}
            <span
              onClick={() => setShowTermsModal(true)}
              className={specificStyles.termsLink}
            >
              Terms and Privacy Policy
            </span>
          </label>
        </div>

        <button
          type="submit"
          className={`${commonStyles.formButton} ${specificStyles.signUpFormButton}`}
          disabled={loading}
        >
          Sign Up
        </button>
      </form>

      {loading && <p>Signing up...</p>}
      {error && <p className={specificStyles.errorMessage}>{error}</p>}
      {facebookLoading && <p>Signing up with Facebook...</p>}
      {facebookError && <p className={specificStyles.errorMessage}>{facebookError}</p>}

      <p className={`${commonStyles.orSeparator} ${specificStyles.signUpOrSeparator}`}>or</p>

      <div className={commonStyles.socialLogin}>
        <button
          onClick={handleFacebookLogin}
          className={commonStyles.socialButton}
          aria-label="Sign up with Facebook"
          disabled={facebookLoading}
        >
          <FaFacebook style={{ color: '#1877F2' }} />
        </button>

        <button
          onClick={() => handleGoogleLogin()}
          className={commonStyles.socialButton}
          aria-label="Sign up with Google"
        >
          <FaGoogle style={{ color: '#DB4437' }} />
        </button>
      </div>

      {showTermsModal && <Terms onClose={() => setShowTermsModal(false)} />}
    </div>
  );
}

export default SignUpForm;