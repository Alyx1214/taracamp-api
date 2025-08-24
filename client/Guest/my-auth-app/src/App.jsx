// src/App.jsx
import { useState } from 'react';
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

import backgroundImage from './assets/background-blur.png';
import styles from './App.module.css';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  useParams,
  useSearchParams
} from 'react-router-dom';

import Transactions from './components/Transactions/Transactions';
import ResHistory from './components/ResHistory/ResHistory';
import ReservationForm from './components/ReservationForm/ResForm';
import ReservationFormStep2 from './components/ReservationForm/ResForm2';
import ReservationFormStep3 from './components/ReservationForm/ResForm3';
import ReservationFormStep4 from './components/ReservationForm/ResDetails';

// NOTE: your folder is "Notification" (singular). Sticking with that.
import Notif from './components/Notification/Notif';
import NotifIndiv from './components/Notification/NotifIndiv';
import NotifPreview from './components/Notification/NotifPreview';
import NotifUpload from './components/Notification/NotifUpload';

// import RequireAuth from './components/Utilities/RequireAuth';

// Hook we wrote earlier (no api.js version)
import { useNotifications } from './components/Utilities/useNotifications';

/* -------------------------
   Inline Notification Pages
--------------------------*/

function NotificationsListPage() {
  const { items, markAllAsRead, markRead } = useNotifications();
  const navigate = useNavigate();

  return (
    <Notif
      notifications={items.map(n => ({
        ...n,
        // clicking the ">" action
        onAction: () => {
          markRead(n.id);
          navigate(`/notifications/${n.id}`); // or choose preview/upload based on n.kind
        }
      }))}
      onMarkAllAsRead={markAllAsRead}
      // clicking the whole row
      onItemClick={(n) => {
        markRead(n.id);
        navigate(`/notifications/${n.id}`);
      }}
    />
  );
}

function NotificationsIndivPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <NotifIndiv
      notif={{ id }}
      onFoodPref={() => navigate('/reservation-step4')}
      onCancel={() => navigate('/reservations')}
    />
  );
}

function NotificationsPreviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <NotifPreview
      notif={{ id }}
      clientType="individual" // adjust if you infer client type elsewhere
      onConfirm={() => navigate('/transactions')}
      onCancel={() => navigate('/reservations')}
    />
  );
}

function NotificationsUploadPage() {
  const { id } = useParams();
  const [qs] = useSearchParams();
  const clientType = qs.get('clientType') || 'deped';
  const navigate = useNavigate();

  return (
    <NotifUpload
      clientType={clientType}
      onSubmit={(files) => {
        // do your upload logic here
        console.log('Uploading documents for', id, files);
        navigate('/reservations');
      }}
    />
  );
}

/* -------------------------
   Auth layout
--------------------------*/
function AuthLayout() {
  const [authFormState, setAuthFormState] = useState('login');
  const [showTermsModal, setShowTermsModal] = useState(false);
  const navigate = useNavigate();

  const toggleAuthForm = (state) => {
    setAuthFormState(state);
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
          isForgotPassword={authFormState === 'forgot-password'}
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
            <ForgotPasswordForm onBackToLogin={() => toggleAuthForm('login')} />
          )}
        </AuthFormContainer>
      </div>
      {showTermsModal && <Terms onClose={() => setShowTermsModal(false)} />}
    </div>
  );
}

/* -------------------------
   App routes
--------------------------*/
function App() {
  const navigate = useNavigate();

  const handleReserveNow = () => {
    navigate('/auth/login');
  };

  return (
    <Routes>
      <Route path="/" element={<LandingPage onReserveNow={handleReserveNow} />} />
      <Route path="/auth/*" element={<AuthLayout />} />
      <Route path="/services/*" element={<MainServices />} />

      {/* <Route element={<RequireAuth />}> */}
      <Route path="/homepage/*" element={<Homepage />} />
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
      {/* </Route> */}

      {/* Notifications */}
      <Route path="/notifications" element={<NotificationsListPage />} />
      <Route path="/notifications/:id" element={<NotificationsIndivPage />} />
      <Route path="/notifications/:id/preview" element={<NotificationsPreviewPage />} />
      <Route path="/notifications/:id/upload" element={<NotificationsUploadPage />} />
    </Routes>
  );
}

/* -------------------------
   Wrapper with Router
--------------------------*/
function AppWrapper() {
  return (
    <Router>
      <App />
    </Router>
  );
}

export default AppWrapper;
