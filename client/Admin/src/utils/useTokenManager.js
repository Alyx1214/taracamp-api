import { useEffect, useCallback } from 'react';
import { ensureFreshAccess, clearTokens } from '../apis/api';

/**
 * Custom hook for managing JWT token lifecycle
 * Provides proactive token refresh and cleanup
 */
export function useTokenManager() {
  const refreshToken = useCallback(async () => {
    try {
      const newToken = await ensureFreshAccess();
      return newToken;
    } catch (error) {
      console.warn('Token refresh failed:', error);
      return null;
    }
  }, []);

  const logout = useCallback(() => {
    try {
      clearTokens();
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, []);

  // Set up periodic token refresh
  useEffect(() => {
    let intervalId = null;

    const setupPeriodicRefresh = () => {
      // Refresh token every 10 minutes (tokens expire in 15 minutes)
      intervalId = setInterval(async () => {
        try {
          await refreshToken();
        } catch (error) {
          console.warn('Periodic token refresh failed:', error);
        }
      }, 10 * 60 * 1000); // 10 minutes
    };

    // Start periodic refresh after a short delay
    const timeoutId = setTimeout(setupPeriodicRefresh, 1000);

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [refreshToken]);

  // Listen for visibility changes to refresh token when tab becomes active
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Tab became visible, refresh token
        refreshToken();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refreshToken]);

  return {
    refreshToken,
    logout,
  };
}
