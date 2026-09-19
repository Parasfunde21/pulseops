import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, api } from '../lib/api';
import { useOrganization } from '../contexts/OrganizationContext';
import { Feedback } from '../components/common/Ui';
import type { Organization, Service } from '../types/api';
import './OnboardingPage.css';

const stepKey = 'pulseops.onboarding.step';
type Step = 2 | 3 | 4;
type ProgressStep = { number: string; label: string; complete: boolean };

function initialStep(): Step {
  const value = Number(sessionStorage.getItem(stepKey));
  return value === 3 || value === 4 ? value : 2;
}

export function OnboardingPage() {
  const navigate = useNavigate();
  const { refresh, selectOrganization } = useOrganization();
  const [step, setStep] = useState<Step>(initialStep);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [environment, setEnvironment] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { sessionStorage.setItem(stepKey, String(step)); }, [step]);

  const createWorkspace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = workspaceName.trim();
    if (!name) { setError('Enter a workspace name.'); return; }
    setBusy(true); setError('');
    try {
      const result = await api.createOrganization(name);
      setOrganization(result.organization);
      selectOrganization(result.organization.id);
      await refresh();
      setStep(3);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Unable to create your workspace. Try again.');
    } finally { setBusy(false); }
  };

  const createService = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = serviceName.trim();
    const repository = repositoryUrl.trim();
    if (!name) { setError('Enter a service name.'); return; }
    if (repository && !/^https?:\/\/\S+$/i.test(repository)) { setError('Repository URL must start with http:// or https://.'); return; }
    if (!organization) { setError('Create a workspace before adding a service.'); return; }
    setBusy(true); setError('');
    try {
      const result = await api.createService(organization.id, { name, repositoryUrl: repository || undefined, environment: environment.trim() || undefined });
      setService(result.service); setStep(4);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Unable to add your service. Try again.');
    } finally { setBusy(false); }
  };

  const progress: ProgressStep[] = [
    { number: '01', label: 'Account', complete: true },
    { number: '02', label: 'Workspace', complete: step >= 3 },
    { number: '03', label: 'Service', complete: step >= 4 },
  ];

  return <main className="onboarding-page"><header className="onboarding-header"><Link to="/" className="brand"><span className="brand-mark">P</span><span>PulseOps</span></Link><span className="onboarding-exit">SETUP / {step === 4 ? 'READY' : `STEP ${step - 1} OF 3`}</span></header><section className="onboarding-shell"><div className="onboarding-progress"><div className="progress-line" />{progress.map((item) => <div className={item.complete ? 'progress-step complete' : 'progress-step'} key={item.label}><span>{item.complete ? 'OK' : item.number}</span><small>{item.label}</small></div>)}</div><div className="onboarding-card">{error && <Feedback message={error} />}{step === 2 && <><span className="eyebrow">STEP 2 / WORKSPACE</span><h1>Create your workspace</h1><p className="onboarding-copy">A workspace is where your engineering team manages services, alerts, and incidents.</p><form onSubmit={createWorkspace} className="onboarding-form"><label>Workspace name<input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="My Engineering Team" autoFocus /></label><button className="button primary" disabled={busy}>{busy ? 'Creating workspace...' : 'Continue'}<span>Go</span></button></form></>}{step === 3 && <><span className="eyebrow">STEP 3 / SERVICE</span><h1>Add your first service</h1><p className="onboarding-copy">A service is an application your team operates, such as a Payment API, Authentication Service, or Notification Service.</p><form onSubmit={createService} className="onboarding-form"><label>Service name<input value={serviceName} onChange={(event) => setServiceName(event.target.value)} placeholder="Payment API" autoFocus /></label><label>Repository URL <span className="optional">OPTIONAL</span><input value={repositoryUrl} onChange={(event) => setRepositoryUrl(event.target.value)} placeholder="https://github.com/example/payment-api" /></label><label>Environment <span className="optional">OPTIONAL</span><input value={environment} onChange={(event) => setEnvironment(event.target.value)} placeholder="Production" /></label><button className="button primary" disabled={busy}>{busy ? 'Adding service...' : 'Add service'}<span>Go</span></button></form></>}{step === 4 && <><span className="eyebrow">SETUP COMPLETE</span><h1>Your PulseOps workspace is ready.</h1><p className="onboarding-copy">Your control room has its first operational context. You can add more services and start managing incidents from the dashboard.</p><div className="setup-summary"><div><small>WORKSPACE</small><strong>{organization?.name}</strong></div><div><small>SERVICE</small><strong>{service?.name}</strong></div></div><button className="button primary" onClick={() => { sessionStorage.removeItem(stepKey); navigate('/dashboard'); }}>Open Dashboard <span>Go</span></button></>}</div></section></main>;
}
