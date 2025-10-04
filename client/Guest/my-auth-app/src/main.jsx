import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { FacebookProvider } from '@kazion/react-facebook-login';
import './index.css';
import App from './App.jsx';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  import.meta.env.VITE_APP_GOOGLE_CLIENT_ID ||
  '843971449324-725ul38951f4m96dk8jrr7f83a6jelh2.apps.googleusercontent.com';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={googleClientId}>
      <FacebookProvider appId="1243513920731621" version="v19.0">
        <App />
      </FacebookProvider>
    </GoogleOAuthProvider>
  </StrictMode>
);
