/// <reference types="express-serve-static-core" />

export interface AuthenticatedIdentity {
  userId: string;
}

export type OrganizationRole = 'owner' | 'admin' | 'member';

export interface OrganizationContext {
  organizationId: string;
  role: OrganizationRole;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthenticatedIdentity;
    organization?: OrganizationContext;
  }
}
