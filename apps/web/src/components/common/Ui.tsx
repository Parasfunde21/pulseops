import type { ReactNode } from 'react';
import type { Severity, IncidentStatus } from '../../types/api';

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) { return <div className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>; }
export function SeverityBadge({ severity }: { severity: Severity }) { return <span className={`badge severity-${severity.toLowerCase()}`}>{severity}</span>; }
export function StatusBadge({ status }: { status: IncidentStatus | 'firing' | 'resolved' | 'active' | 'inactive' }) { return <span className={`badge status-${status}`}>{status.replace('_', ' ')}</span>; }
export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) { return <div className="empty-state"><span className="empty-icon">∅</span><h3>{title}</h3><p>{body}</p>{action}</div>; }
export function Feedback({ message, tone = 'error' }: { message: string; tone?: 'error' | 'success' }) { return <div className={`feedback ${tone}`} role="alert">{message}</div>; }
export function LoadingState() { return <div className="loading-state"><span className="spinner" />Loading operational data...</div>; }
export function formatDate(value: string) { return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
