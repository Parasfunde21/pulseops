import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useOrganization } from '../contexts/OrganizationContext';
import { Feedback, LoadingState } from '../components/common/Ui';
import { DashboardPage } from './Pages';
import './OnboardingPage.css';

export function DashboardEntryPage() {
  const { selectedOrganizationId } = useOrganization();
  const [hasServices, setHasServices] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!selectedOrganizationId) return;
    api.services(selectedOrganizationId).then(({ services }) => setHasServices(services.length > 0)).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load workspace data.'));
  }, [selectedOrganizationId]);
  if (!selectedOrganizationId) return <DashboardPage />;
  if (error) return <div className="page"><Feedback message={error} /></div>;
  if (hasServices === null) return <LoadingState />;
  if (hasServices) return <DashboardPage />;
  return <div className="page empty-dashboard"><span className="eyebrow">NEW WORKSPACE</span><h1>Welcome to PulseOps</h1><p className="empty-dashboard-lead">Your incident control room starts here. Connect your first service to give your team a shared place to understand and resolve operational problems.</p><div className="empty-dashboard-steps"><div><span>01</span><strong>Connect your services</strong><p>Register the applications your team operates.</p></div><div><span>02</span><strong>Receive alerts</strong><p>Bring operational signals into one context.</p></div><div><span>03</span><strong>Investigate incidents</strong><p>Use timelines and advisory AI analysis.</p></div><div><span>04</span><strong>Resolve problems</strong><p>Keep the response accountable and complete.</p></div></div><Link className="button primary" to="/services">Add Service <span>Go</span></Link></div>;
}
