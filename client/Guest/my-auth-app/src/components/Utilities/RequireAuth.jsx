import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { ensureFreshAccess } from "../../apis/api";

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

export default function RequireAuth() {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("accessToken");
      
      if (!token || isTokenExpired(token)) {
        setIsAuthenticated(false);
        setIsChecking(false);
        return;
      }
      
      // Try to ensure we have a fresh token
      try {
        const freshToken = await ensureFreshAccess();
        setIsAuthenticated(!!freshToken);
      } catch (error) {
        console.warn('Auth check failed:', error);
        setIsAuthenticated(false);
      } finally {
        setIsChecking(false);
      }
    };
    
    checkAuth();
  }, []);

  if (isChecking) {
    // Show loading state while checking authentication
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  return <Outlet />;
}
