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
import PendingRSVDetails from "./components/ReservationDetails/PendingRSVDetails.jsx";
import ApprovedRSVDetails from "./components/ReservationDetails/ApprovedRSVDetails.jsx";
import ConfIndivRSVDetails from "./components/ReservationDetails/ConfIndivRSVDetails.jsx";
import ConfGroupRSVDetails from "./components/ReservationDetails/ConfGroupRSVDetails.jsx";
import AddForm from "../src/components/Facility/AddForm.jsx";
import EditForm from "../src/components/Facility/EditForm.jsx"; 
import Transaction from "./components/Transaction/Transaction.jsx";
import TransactionDetails from "./components/Transaction/TransactionDetails.jsx";
import PaymentDetails from "./components/Transaction/PaymentDetails.jsx";
import CheckInOut from "./components/CheckInOut/CheckInOuts.jsx";
import Reports from "./components/Report/Report.jsx";
import User from "./components/Users/Users.jsx";
import AddUserForm from "./components/Users/AddUsersForm.jsx";

// Auth views (copied structure)
import AuthFormContainer from './components/AuthFormContainer/AuthFormContainer.jsx';
import AuthSidePanel from './components/AuthSidePanel/AuthSidePanel.jsx';
import LoginForm from './components/LoginForm/LoginForm.jsx';
import ForgotPasswordForm from './components/ForgotPasswordForm/ForgotPasswordForm.jsx';
import authStyles from './auth/Auth.module.css';
import bgImage from './assets/background-blur.png';
import logo from './assets/logo.png';
import RequireAuth from './components/Utilities/RequireAuth.jsx';

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
return (
<BrowserRouter>
<Routes>
<Route path="/auth/*" element={<AuthLayout />} />
<Route element={<RequireAuth />}>
<Route path="/" element={<Layout />}>
<Route index element={<Dashboard />} />

<Route path="dashboard" element={<Dashboard />} />
<Route path="reservations" element={<Reservations />} />
<Route path="facilities" element={<Facilities />} />
<Route path="transactions" element={<Transaction />} />
<Route path="user" element={<User />} />
<Route path="users/add" element={<AddUserForm />} />
<Route path="checkin" element={<CheckInOut />} />
<Route path="reports" element={<Reports />} /> 
<Route path="/reservations/add" element={<AddReservation />} />
<Route path="/reservation-form" element={<ReservationForm />} />
<Route path="/reservation-step2" element={<ReservationFormStep2 />} />
<Route path="/reservation-step3" element={<ReservationFormStep3 />} />
<Route path="/reservation-step4" element={<ReservationFormStep4 />} />

<Route path="/add-facility" element={<AddForm />} />
<Route path="/facilities/edit/:id" element={<EditForm />} />

<Route path="/transaction/:id/details" element={<TransactionDetails />} /> 

<Route path="/payment/:id/details" element={<PaymentDetails />} /> 

<Route path="/pendingRSV/:id/details" element={<PendingRSVDetails />} />
<Route path="/approvedRSV/:id/details" element={<ApprovedRSVDetails />} />
<Route path="/confirmedIndiv/:id/details" element={<ConfIndivRSVDetails />} />
<Route path="/confirmedGroup/:id/details" element={<ConfGroupRSVDetails />} />

<Route path="*" element={<Navigate to="/" replace />} />
</Route>
</Route>
</Routes>
</BrowserRouter>
);
}

export default App;
