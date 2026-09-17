import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { storage } from '../lib/storage';
import type { Organization } from '../types/api';
import { useAuth } from './AuthContext';

interface OrganizationContextValue { organizations: Organization[]; selectedOrganization: Organization | null; selectedOrganizationId: string | null; loading: boolean; selectOrganization: (id: string) => void; refresh: () => Promise<void>; }
const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(storage.getOrganizationId());
  const [loading, setLoading] = useState(Boolean(token));
  const refresh = async () => { if (!token) { setOrganizations([]); setLoading(false); return; } setLoading(true); try { const result = await api.organizations(); setOrganizations(result.organizations); const stored = storage.getOrganizationId(); const selected = result.organizations.find((organization) => organization.id === stored) ?? (result.organizations.length === 1 ? result.organizations[0] : null); setSelectedOrganizationId(selected?.id ?? null); if (selected) storage.setOrganizationId(selected.id); else storage.clearOrganizationId(); } finally { setLoading(false); } };
  useEffect(() => { void refresh(); }, [token]);
  const selectOrganization = (id: string) => { setSelectedOrganizationId(id); storage.setOrganizationId(id); };
  const selectedOrganization = organizations.find((organization) => organization.id === selectedOrganizationId) ?? null;
  return <OrganizationContext.Provider value={{ organizations, selectedOrganization, selectedOrganizationId, loading, selectOrganization, refresh }}>{children}</OrganizationContext.Provider>;
}
export function useOrganization() { const value = useContext(OrganizationContext); if (!value) throw new Error('useOrganization must be used within OrganizationProvider'); return value; }
