import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { OrganizationProvider } from './contexts/OrganizationContext';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { AlertDetailPage, AlertsPage, DashboardPage, IncidentDetailPage, IncidentsPage, LoginPage, OrganizationPage, ServicesPage } from './pages/Pages';

export function App() {
  return <BrowserRouter><AuthProvider><OrganizationProvider><Routes><Route path="/login" element={<LoginPage />} /><Route element={<ProtectedRoute />}><Route path="/organizations" element={<OrganizationPage />} /><Route element={<AppLayout />}><Route index element={<DashboardPage />} /><Route path="/services" element={<ServicesPage />} /><Route path="/incidents" element={<IncidentsPage />} /><Route path="/incidents/:incidentId" element={<IncidentDetailPage />} /><Route path="/alerts" element={<AlertsPage />} /><Route path="/alerts/:alertId" element={<AlertDetailPage />} /></Route></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes></OrganizationProvider></AuthProvider></BrowserRouter>;
}
