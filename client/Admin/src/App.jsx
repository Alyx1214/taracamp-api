import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import Layout from "./components/Layout/Layout";
import Dashboard from "../src/components/Dashboard/Dashboard.jsx";
import Reservations from "./components/Reservation/Reservations";
import Facilities from "./components/Facility/Facilities";
import AddReservation from "../src/components/Reservation/AddReservation.jsx";
import ReservationForm from './components/ReservationForm/ResForm.jsx';
import ReservationFormStep2 from './components/ReservationForm/ResForm2.jsx';
import ReservationFormStep3 from './components/ReservationForm/ResForm3.jsx';
import ReservationFormStep4 from './components/ReservationForm/ResDetails.jsx';
import { SeniorCitizenReservationForm, PWDReservationForm } from './components/ReservationForm/IDUploadBin.jsx';
import EditReservation from './components/ReservationForm/EditReservation.jsx';
import PendingRSVDetails from "./components/ReservationDetails/PendingRSVDetails.jsx";
import ApprovedRSVDetails from "./components/ReservationDetails/ApprovedRSVDetails.jsx";
import ConfIndivRSVDetails from "./components/ReservationDetails/ConfIndivRSVDetails.jsx";
import ConfGroupRSVDetails from "./components/ReservationDetails/ConfGroupRSVDetails.jsx";
import ReservationDetail from "./components/Reservation/ReservationDetail.jsx";
import AddForm from "../src/components/Facility/AddForm.jsx";
import EditForm from "../src/components/Facility/EditForm.jsx"; 
import Transaction from "./components/Transaction/Transaction.jsx";
import TransactionDetails from "./components/Transaction/TransactionDetails.jsx";
import PaymentDetails from "./components/Transaction/PaymentDetails.jsx";
import GenerateReport from "./components/Transaction/GenerateReport.jsx";
import CheckInOut from "./components/CheckInOut/CheckInOuts.jsx";
import Messages from "./components/Messages/Messages.jsx";
import User from "./components/Users/Users.jsx";
import AddUserForm from "./components/Users/AddUsersForm.jsx";
import Manage from "./components/Facility/Manage.jsx";

// Auth views (copied structure)
import AuthFormContainer from './components/AuthFormContainer/AuthFormContainer.jsx';
import AuthSidePanel from './components/AuthSidePanel/AuthSidePanel.jsx';
import LoginForm from './components/LoginForm/LoginForm.jsx';
import ForgotPasswordForm from './components/ForgotPasswordForm/ForgotPasswordForm.jsx';
import authStyles from './auth/Auth.module.css';
import bgImage from './assets/background-blur.png';
import logo from './assets/logo.png';
import RequireAuth from './components/Utilities/RequireAuth.jsx';
import { useTokenManager } from './utils/useTokenManager.js';
import RoleGuard from './components/Utilities/RoleGuard.jsx';

function AuthLayout() {
  const [authFormState, setAuthFormState] = useState('login');
  const navigate = useNavigate();
  const location = useLocation();
  const handleLoginSuccess = () => navigate('/dashboard');

  useEffect(() => {
    const seg = location.pathname.split('/').filter(Boolean).pop();
    if (seg === 'forgot-password') setAuthFormState('forgot-password');
    else setAuthFormState('login');
  }, [location.pathname]);

  return (
    <div className={authStyles.authPageWrapper} style={{ backgroundImage: `url(${bgImage})` }}>
      <div className={authStyles.authContainer}>
        <AuthSidePanel
          isLogin={authFormState === 'login'}
          isForgotPassword={authFormState === 'forgot-password'}
          onToggleForm={(state) => {
            setAuthFormState(state);
            navigate(`/auth/${state}`);
          }}
          logo={logo}
        />
        <AuthFormContainer>
          {authFormState === 'login' && (
            <LoginForm
              onLoginSuccess={handleLoginSuccess}
              onForgotPassword={() => {
                setAuthFormState('forgot-password');
                navigate('/auth/forgot-password');
              }}
            />
          )}
          {authFormState === 'forgot-password' && (
            <ForgotPasswordForm onBackToLogin={() => {
              setAuthFormState('login');
              navigate('/auth/login');
            }} />
          )}
        </AuthFormContainer>
      </div>
    </div>
  );
}

function App() {
  // Initialize token manager for the entire app
  useTokenManager();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth/*" element={<AuthLayout />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />

            <Route path="dashboard" element={<Dashboard />} />
            <Route path="reservations" element={<RoleGuard routeKey="reservations"><Reservations /></RoleGuard>} />
            <Route path="facilities" element={<RoleGuard routeKey="facilities"><Facilities /></RoleGuard>} />
            <Route path="transactions" element={<RoleGuard routeKey="transactions"><Transaction /></RoleGuard>} />
            <Route path="user" element={<RoleGuard routeKey="user"><User /></RoleGuard>} />
            <Route path="users/add" element={<RoleGuard routeKey="user"><AddUserForm /></RoleGuard>} />
            <Route path="users/edit/:id" element={<RoleGuard routeKey="user"><AddUserForm /></RoleGuard>} />
            <Route path="checkin" element={<RoleGuard routeKey="checkin"><CheckInOut /></RoleGuard>} />
            <Route path="messages" element={<RoleGuard routeKey="messages"><Messages /></RoleGuard>} />
            <Route path="/reservations/add" element={<RoleGuard routeKey="reservations"><AddReservation /></RoleGuard>} />
            <Route path="/reservation-form" element={<RoleGuard routeKey="reservations"><ReservationForm /></RoleGuard>} />
            <Route path="/reservation-step2" element={<RoleGuard routeKey="reservations"><ReservationFormStep2 /></RoleGuard>} />
            <Route path="/reservation-step3" element={<RoleGuard routeKey="reservations"><ReservationFormStep3 /></RoleGuard>} />
            <Route path="/reservation-step3-senior" element={<RoleGuard routeKey="reservations"><SeniorCitizenReservationForm /></RoleGuard>} />
            <Route path="/reservation-step3-pwd" element={<RoleGuard routeKey="reservations"><PWDReservationForm /></RoleGuard>} />
            <Route path="/reservation-step4" element={<RoleGuard routeKey="reservations"><ReservationFormStep4 /></RoleGuard>} />
            <Route path="/reservations/:id/edit" element={<RoleGuard routeKey="reservations"><EditReservation /></RoleGuard>} />

            <Route path="/add-facility" element={<RoleGuard routeKey="facilities"><AddForm /></RoleGuard>} />
            <Route path="/facilities/edit/:id" element={<RoleGuard routeKey="facilities"><EditForm /></RoleGuard>} />
            <Route path="/facilities/manage/:id" element={<RoleGuard routeKey="facilities"><Manage /></RoleGuard>} />

            <Route path="/reservation/:id/details" element={<RoleGuard routeKey="reservations"><ReservationDetail /></RoleGuard>} />
            <Route path="/transaction/:id/details" element={<RoleGuard routeKey="transactions"><TransactionDetails /></RoleGuard>} /> 

            <Route path="/payment/:id/details" element={<RoleGuard routeKey="transactions"><PaymentDetails /></RoleGuard>} /> 
            <Route path="/transactions/report" element={<RoleGuard routeKey="transactions"><GenerateReport /></RoleGuard>} />
            <Route path="/pendingRSV/:id/details" element={<RoleGuard routeKey="reservations"><PendingRSVDetails /></RoleGuard>} />
            <Route path="/approvedRSV/:id/details" element={<RoleGuard routeKey="reservations"><ApprovedRSVDetails /></RoleGuard>} />
            <Route path="/confirmedIndiv/:id/details" element={<RoleGuard routeKey="reservations"><ConfIndivRSVDetails /></RoleGuard>} />
            <Route path="/confirmedGroup/:id/details" element={<RoleGuard routeKey="reservations"><ConfGroupRSVDetails /></RoleGuard>} />
  

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
