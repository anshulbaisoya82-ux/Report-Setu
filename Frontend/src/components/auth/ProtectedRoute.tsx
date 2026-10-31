import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getAccessToken, getStoredRole } from '../../api/client';

interface ProtectedRouteProps {
  role: 'doctor' | 'patient';
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ role, children }) => {
  const location = useLocation();
  const token = getAccessToken();
  const storedRole = getStoredRole();

  if (!token || storedRole !== role) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
};
