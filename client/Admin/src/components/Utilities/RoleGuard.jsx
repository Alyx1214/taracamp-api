import React from 'react';
import { Navigate } from 'react-router-dom';

export default function RoleGuard({ routeKey, children }) {
  const role = (typeof window !== 'undefined' && localStorage.getItem('userRole')) || '';

  const roleAllowedKeys = {
    'CRMS TEAM': new Set(["dashboard", "facilities", "reservations", "transactions"]),
    'ACCOUNTING': new Set(["dashboard", "transactions"]),
    'FRONTDESK': new Set(["dashboard", "facilities", "reservations", "transactions", "checkin", "messages"]),
  };

  const allowedSet = roleAllowedKeys[role] || null; // null → unrestricted

  if (!routeKey || !allowedSet) return children;
  if (allowedSet.has(routeKey)) return children;

  return <Navigate to="/dashboard" replace />;
}


