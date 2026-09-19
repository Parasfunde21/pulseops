import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { OrganizationProvider } from './contexts/OrganizationContext';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { AlertDetailPage, AlertsPage, IncidentDetailPage, IncidentsPage, LoginPage, OrganizationPage, ServicesPage } from './pages/Pages';
import { LandingPage } from './pages/LandingPage';
import { RegisterPage } from './pages/RegisterPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { DashboardEntryPage } from './pages/DashboardEntryPage';

export function App() {
  return <BrowserRouter><AuthProvider><OrganizationProvider><Routes><Route path="/" element={<LandingPage />} /><Route path="/login" element={<LoginPage />} /><Route path="/register" element={<RegisterPage />} /><Route element={<ProtectedRoute />}><Route path="/organizations" element={<OrganizationPage />} /><Route path="/onboarding" element={<OnboardingPage />} /><Route element={<AppLayout />}><Route path="/dashboard" element={<DashboardEntryPage />} /><Route path="/services" element={<ServicesPage />} /><Route path="/incidents" element={<IncidentsPage />} /><Route path="/incidents/:incidentId" element={<IncidentDetailPage />} /><Route path="/alerts" element={<AlertsPage />} /><Route path="/alerts/:alertId" element={<AlertDetailPage />} /></Route></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes></OrganizationProvider></AuthProvider></BrowserRouter>;
}
