export interface AuthenticatedIdentity {
  userId: string;
  organizationId?: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedIdentity;
    }
  }
}

export {};
