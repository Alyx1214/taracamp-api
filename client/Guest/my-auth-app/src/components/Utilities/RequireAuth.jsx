import React, { useEffect, useState, useRef } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { ensureFreshAccess, tryRefresh, clearTokens } from "../../apis/api";

function isTokenExpired(token) {
  try {
    if (!token) return true;
    const [, payloadBase64] = token.split(".");
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
    const [, payloadBase64] = token.split(".");
    if (!payloadBase64) return 0;
    const payload = JSON.parse(atob(payloadBase64));
    return payload.exp * 1000;
  } catch {
    return 0;
  }
}

export default function RequireAuth() {
  const [status, setStatus] = useState('checking'); // checking | authed | redirect
  const [tokenVersion, setTokenVersion] = useState(0); // Force re-render when token changes
  const lastRefreshTimeRef = useRef(0);
  const REFRESH_COOLDOWN = 10000; // 10 seconds cooldown between refresh attempts

  useEffect(() => {
    let cancelled = false;
    let refreshTimer = null;
    let checkInterval = null;

    async function ensureAuth() {
      // Get current token (may have been updated)
      const currentToken = localStorage.getItem("accessToken");
      
      // No token at all → redirect
      if (!currentToken) {
        if (!cancelled) setStatus('redirect');
        return;
      }

      // Token present and valid → proceed
      if (!isTokenExpired(currentToken)) {
        if (!cancelled) setStatus('authed');
        
        // Set up proactive token refresh
        const expTime = getTokenExpirationTime(currentToken);
        if (expTime > 0) {
          // Refresh token 2 minutes before expiration
          const refreshTime = expTime - Date.now() - (2 * 60 * 1000);
          if (refreshTime > 0) {
            // Clear any existing timer
            if (refreshTimer) clearTimeout(refreshTimer);
            
            refreshTimer = setTimeout(async () => {
              if (!cancelled) {
                const now = Date.now();
                if (now - lastRefreshTimeRef.current < REFRESH_COOLDOWN) {
                  // Too soon since last refresh, skip this one
                  return;
                }
                lastRefreshTimeRef.current = now;
                try {
                  const newToken = await ensureFreshAccess();
                  if (newToken && !cancelled) {
                    // Token was refreshed, trigger re-check
                    setTokenVersion(prev => prev + 1);
                    ensureAuth();
                  }
                } catch (error) {
                  console.warn('Proactive token refresh failed:', error);
                }
              }
            }, refreshTime);
          } else {
            // Token expires soon, refresh immediately (with cooldown check)
            const now = Date.now();
            if (now - lastRefreshTimeRef.current >= REFRESH_COOLDOWN) {
              lastRefreshTimeRef.current = now;
              try {
                const newToken = await ensureFreshAccess();
                if (newToken && !cancelled) {
                  setTokenVersion(prev => prev + 1);
                  ensureAuth();
                }
              } catch (error) {
                console.warn('Immediate token refresh failed:', error);
              }
            }
          }
        }
        return;
      }

      // Token expired → try refresh once (with cooldown check)
      const now = Date.now();
      if (now - lastRefreshTimeRef.current >= REFRESH_COOLDOWN) {
        lastRefreshTimeRef.current = now;
        const newAccess = await tryRefresh();
        if (cancelled) return;
        if (newAccess) {
          if (!cancelled) {
            setStatus('authed');
            setTokenVersion(prev => prev + 1);
            // Set up refresh for the new token
            ensureAuth();
          }
        } else {
          try { clearTokens(); } catch {}
          if (!cancelled) setStatus('redirect');
        }
      } else {
        // Too soon since last refresh, keep current status
        if (!cancelled && status !== 'authed') {
          setStatus('authed'); // Assume still authenticated if refresh was recent
        }
      }
    }

    // Initial auth check
    ensureAuth();

    // Set up periodic check every 1 minute to catch token expiration and refresh
    checkInterval = setInterval(() => {
      if (!cancelled) {
        const currentToken = localStorage.getItem("accessToken");
        if (!currentToken) {
          if (!cancelled) setStatus('redirect');
          return;
        }
        
        // Check if token is expired or about to expire
        const now = Date.now();
        if (isTokenExpired(currentToken)) {
          // Token expired, try to refresh (with cooldown check)
          if (now - lastRefreshTimeRef.current >= REFRESH_COOLDOWN) {
            ensureAuth();
          }
        } else {
          // Token still valid, but check if we need to refresh proactively
          const expTime = getTokenExpirationTime(currentToken);
          const timeUntilExpiry = expTime - Date.now();
          // If less than 3 minutes until expiry, refresh now (with cooldown check)
          if (timeUntilExpiry > 0 && timeUntilExpiry < 3 * 60 * 1000) {
            if (now - lastRefreshTimeRef.current >= REFRESH_COOLDOWN) {
              ensureAuth();
            }
          }
        }
      }
    }, 60 * 1000); // Check every 1 minute
    
    return () => { 
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [tokenVersion]);

  // Listen for storage changes (token updates from other tabs)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'accessToken') {
        // Token was updated in another tab, re-check auth
        setTokenVersion(prev => prev + 1);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Listen for visibility changes to refresh token when tab becomes active
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        // Tab became visible, check and refresh token if needed
        const currentToken = localStorage.getItem("accessToken");
        if (currentToken) {
          const now = Date.now();
          // Only refresh if cooldown has passed
          if (now - lastRefreshTimeRef.current < REFRESH_COOLDOWN) {
            return; // Skip if too soon since last refresh
          }
          
          if (isTokenExpired(currentToken)) {
            // Token expired while tab was hidden, try to refresh
            lastRefreshTimeRef.current = now;
            const newAccess = await tryRefresh();
            if (newAccess) {
              setTokenVersion(prev => prev + 1);
            }
          } else {
            // Token still valid, but refresh proactively if close to expiry
            const expTime = getTokenExpirationTime(currentToken);
            const timeUntilExpiry = expTime - Date.now();
            if (timeUntilExpiry > 0 && timeUntilExpiry < 5 * 60 * 1000) {
              // Less than 5 minutes until expiry, refresh now
              lastRefreshTimeRef.current = now;
              const newToken = await ensureFreshAccess();
              if (newToken) {
                setTokenVersion(prev => prev + 1);
              }
            }
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  if (status === 'checking') {
    // Show loading state while checking authentication
    return <div>Loading...</div>;
  }

  if (status === 'redirect') {
    return <Navigate to="/auth/login" replace />;
  }

  return <Outlet />;
}
