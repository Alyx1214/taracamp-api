import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { tryRefresh, clearTokens } from '../../apis/api';

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

export default function RequireAuth() {
  const [status, setStatus] = useState('checking'); // checking | authed | redirect

  const token = useMemo(() => localStorage.getItem('accessToken'), []);

  useEffect(() => {
    let cancelled = false;

    async function ensureAuth() {
      // No token at all → redirect
      if (!token) {
        if (!cancelled) setStatus('redirect');
        return;
      }

      // Token present and valid → proceed
      if (!isTokenExpired(token)) {
        if (!cancelled) setStatus('authed');
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
    return () => { cancelled = true; };
  }, [token]);

  if (status === 'checking') return null; // or a small spinner if desired
  if (status === 'redirect') return <Navigate to="/auth/login" replace />;
  return <Outlet />;
}
