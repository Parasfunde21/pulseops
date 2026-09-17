import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingState } from './Ui';
export function ProtectedRoute() { const { token, loading } = useAuth(); const location = useLocation(); if (loading) return <LoadingState />; return token ? <Outlet /> : <Navigate to="/login" replace state={{ from: location.pathname }} />; }
