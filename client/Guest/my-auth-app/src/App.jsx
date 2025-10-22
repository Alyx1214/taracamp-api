import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import AuthFormContainer from './components/AuthFormContainer/AuthFormContainer';
import AuthSidePanel from './components/AuthSidePanel/AuthSidePanel';
import LoginForm from './components/LoginForm/LoginForm';
import SignUpForm from './components/SignUpForm/SignUpForm';
import ForgotPasswordForm from './components/ForgotPasswordForm/ForgotPasswordForm';
import Terms from './components/Terms/Terms';
import LandingPage from './components/LandingPage/LandingPage';
import MainServices from './components/MainServices/MainServices';
import Homepage from './components/Homepage/Homepage';
import HistoryPage from './components/History/History';
import ServicesPage from './components/MServices/Services';
import FAQsPage from './components/FAQs/FAQs';
import ContactsPage from './components/Contacts/Contacts';
import Transactions from './components/Transactions/Transactions';
import ResHistory from './components/ResHistory/ResHistory';
import ReservationForm from './components/ReservationForm/ResForm';
import ReservationFormStep2 from './components/ReservationForm/ResForm2';
import ReservationFormStep3 from './components/ReservationForm/ResForm3';
import ReservationFormStep4 from './components/ReservationForm/ResDetails';
import RequireAuth from './components/Utilities/RequireAuth'; 
import backgroundImage from './assets/background-blur.png';
import VerifyCode from './components/VerifyCode/VerifyCode';
import ResetPassword from './components/ResetPassword/ResetPassword';
import styles from './App.module.css';

function AuthLayout() {
  const [authFormState, setAuthFormState] = useState('login');
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  // Detect current route and set appropriate form state
  useEffect(() => {
    const path = location.pathname;
    if (path === '/auth/signup') {
      setAuthFormState('signup');
    } else if (path === '/auth/login') {
      setAuthFormState('login');
    } else if (path === '/auth/forgot-password') {
      setAuthFormState('forgot-password');
    } else if (path === '/auth/verify-code') {
      setAuthFormState('verify-code');
    } else if (path === '/auth/reset-password') {
      setAuthFormState('reset-password');
    }
  }, [location.pathname]);

  const toggleAuthForm = (state) => {
    setAuthFormState(state);
    if (state === 'login') {
      setResetEmail('');
      setResetToken('');
    }
    navigate(`/auth/${state}`);
  };

  const handleLoginSuccess = () => {
    navigate('/homepage');
  };

  return (
    <div className={styles.authPageWrapper} style={{ backgroundImage: `url(${backgroundImage})` }}>
      <div className={styles.authContainer}>
        <AuthSidePanel
          isLogin={authFormState === 'login'}
          isForgotPassword={['forgot-password', 'verify-code', 'reset-password'].includes(authFormState)}
          onToggleForm={toggleAuthForm}
        />
        <AuthFormContainer>
          {authFormState === 'login' && (
            <LoginForm
              onForgotPassword={() => toggleAuthForm('forgot-password')}
              onLoginSuccess={handleLoginSuccess}
            />
          )}
          {authFormState === 'signup' && (
            <SignUpForm
              onShowTerms={() => setShowTermsModal(true)}
              onRegistrationSuccess={() => {
                setAuthFormState('login');
                navigate('/auth/login');
              }}
            />
          )}
          {authFormState === 'forgot-password' && (
            <ForgotPasswordForm
              initialEmail={resetEmail}
              onBackToLogin={() => toggleAuthForm('login')}
              onCodeSent={(email) => {
                setResetEmail(email);
                setResetToken('');
                setAuthFormState('verify-code');
                navigate('/auth/verify-code');
              }}
            />
          )}
          {authFormState === 'verify-code' && (
            <VerifyCode
              email={resetEmail}
              onBackToForgot={() => toggleAuthForm('forgot-password')}
              onVerified={(token) => {
                setResetToken(token);
                setAuthFormState('reset-password');
                navigate('/auth/reset-password');
              }}
            />
          )}
          {authFormState === 'reset-password' && (
            <ResetPassword
              email={resetEmail}
              resetToken={resetToken}
              onBackToLogin={() => toggleAuthForm('login')}
              onResetComplete={() => toggleAuthForm('login')}
            />
          )}
        </AuthFormContainer>
      </div>
      {showTermsModal && <Terms onClose={() => setShowTermsModal(false)} />}
    </div>
  );
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const handleReserveNow = () => {
    const servicesPath = '/services';
    
    if (location.pathname === servicesPath) {
      // Already on services page, scroll to top instantly
      window.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      // Navigate to services page and scroll to top instantly
      navigate(servicesPath);
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }, 100);
    }
  };

  const handleHomepageReserveNow = () => {
    const servicesPath = '/user/services';
    
    if (location.pathname === servicesPath) {
      // Already on services page, scroll to top instantly
      window.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      // Navigate to services page and scroll to top instantly
      navigate(servicesPath);
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }, 100);
    }
  };

  return (
    <Routes>
      <Route path="/" element={<LandingPage onReserveNow={handleReserveNow} />} />
      <Route path="/auth/*" element={<AuthLayout />} />
      <Route path="/services/*" element={<MainServices />} />

      {/* <Route element={<RequireAuth />}> */}
      <Route
        path="/homepage/*"
        element={<Homepage onReserveNow={handleHomepageReserveNow} isLoggedIn />}
      />
      <Route path="/history" element={<HistoryPage />} />
      <Route path="/user/services/*" element={<ServicesPage />} />
      <Route path="/faqs" element={<FAQsPage />} />
      <Route path="/contacts" element={<ContactsPage />} />
      <Route path="/transactions" element={<Transactions />} />
      <Route path="/reservations" element={<ResHistory />} />
      <Route path="/reservation-form" element={<ReservationForm />} />
      <Route path="/reservation-step2" element={<ReservationFormStep2 />} />
      <Route path="/reservation-step3" element={<ReservationFormStep3 />} />
      <Route path="/reservation-step4" element={<ReservationFormStep4 />} />
      <Route path="/reservation-form/:type/:facilityName/:id" element={<ReservationForm />} />
      <Route path="/reservation-step2/:type/:facilityName/:id" element={<ReservationFormStep2 />} />
      <Route path="/reservation-step3/:type/:facilityName/:id" element={<ReservationFormStep3 />} />
      <Route path="/reservation-step4/:type/:facilityName/:id" element={<ReservationFormStep4 />} />
      {/* </Route> */}
    </Routes>
  );
}

function AppWrapper() {
  return (
    <Router>
      <App />
    </Router>
  );
}

export default AppWrapper;
