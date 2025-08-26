// src/App.jsx
import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';

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
import Notif from './components/Notification/Notif';
import NotifPreview from './components/Notification/NotifPreview';
import NotifUpload from './components/Notification/NotifUpload';
import { useNotifications } from './components/Utilities/useNotifications';

const API = import.meta.env.VITE_API_URL; 

function NotificationsListPage() {
  const { items, markAllAsRead, markRead } = useNotifications();
  const navigate = useNavigate();
  return (
    <Notif
      notifications={items.map(n => ({
        ...n,
        onAction: () => {
          markRead(n.id);
          navigate(`/notifications/${n.id}/preview`);
        }
      }))}
      onMarkAllAsRead={markAllAsRead}
      onItemClick={(n) => {
        markRead(n.id);
        navigate(`/notifications/${n.id}/preview`);
      }}
    />
  );
}

function NotificationsPreviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  async function loadReservation() {
    const res = await fetch(VITE_API_URL + `/reservations/${id}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load');
    return res.json();
  }
  return (
    <NotifPreview
      notif={{ id }}
      clientType="individual"
      loadReservation={loadReservation}
      onConfirm={() => navigate('/transactions')}
      onCancel={() => navigate('/reservations')}
      onBack={() => navigate('/notifications')}
    />
  );
}

// ===== Auth layout =====
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

// ===== Main app routes =====
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

      {/* Messenger-style notifications: single route */}
      <Route path="/notifications" element={<NotificationsListPage />} />
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
