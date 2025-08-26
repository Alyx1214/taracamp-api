import React from "react";
import { Navigate, Outlet } from "react-router-dom";

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
  const token = localStorage.getItem("accessToken");
  if (!token || isTokenExpired(token)) {
    return <Navigate to="/auth/login" replace />;
  }
  return <Outlet />;
}
