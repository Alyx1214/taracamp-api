import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { tryRefresh, clearTokens, ensureFreshAccess } from '../../apis/api';

function isTokenExpired(token) {
  try {
    if (!token) return true;
    const [, payloadBase64] = token.split('.');
    if (!payloadBase64) return true;
    const payload = JSON.parse(atob(payloadBase64));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

function getTokenExpirationTime(token) {
  try {
    if (!token) return 0;
    const [, payloadBase64] = token.split('.');
    if (!payloadBase64) return 0;
    const payload = JSON.parse(atob(payloadBase64));
    return payload.exp * 1000;
  } catch {
    return 0;
  }
}

export default function RequireAuth() {
  const [status, setStatus] = useState('checking'); // checking | authed | redirect

  const token = useMemo(() => localStorage.getItem('accessToken'), []);

  useEffect(() => {
    let cancelled = false;
    let refreshTimer = null;

    async function ensureAuth() {
      // No token at all → redirect
      if (!token) {
        if (!cancelled) setStatus('redirect');
        return;
      }

      // Token present and valid → proceed
      if (!isTokenExpired(token)) {
        if (!cancelled) setStatus('authed');
        
        // Set up proactive token refresh
        const expTime = getTokenExpirationTime(token);
        if (expTime > 0) {
          // Refresh token 2 minutes before expiration
          const refreshTime = expTime - Date.now() - (2 * 60 * 1000);
          if (refreshTime > 0) {
            refreshTimer = setTimeout(async () => {
              if (!cancelled) {
                try {
                  await ensureFreshAccess();
                } catch (error) {
                  console.warn('Proactive token refresh failed:', error);
                }
              }
            }, refreshTime);
          }
        }
        return;
      }

      // Token expired → try refresh once
      const newAccess = await tryRefresh();
      if (cancelled) return;
      if (newAccess) {
        setStatus('authed');
      } else {
        try { clearTokens(); } catch {}
        setStatus('redirect');
      }
    }

    ensureAuth();
    
    return () => { 
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [token]);

  // Listen for storage changes (token updates from other tabs)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'accessToken' && e.newValue !== token) {
        // Token was updated in another tab, re-check auth
        window.location.reload();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [token]);

  if (status === 'checking') return null; // or a small spinner if desired
  if (status === 'redirect') return <Navigate to="/auth/login" replace />;
  return <Outlet />;
}
