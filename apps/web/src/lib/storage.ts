const tokenKey = 'pulseops.accessToken';
const organizationKey = 'pulseops.organizationId';

export const storage = {
  getToken: () => localStorage.getItem(tokenKey),
  setToken: (token: string) => localStorage.setItem(tokenKey, token),
  clearToken: () => localStorage.removeItem(tokenKey),
  getOrganizationId: () => localStorage.getItem(organizationKey),
  setOrganizationId: (id: string) => localStorage.setItem(organizationKey, id),
  clearOrganizationId: () => localStorage.removeItem(organizationKey),
};
