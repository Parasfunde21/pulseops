# Architecture overview

PulseOps is a pnpm workspace monorepo. Applications live in `apps/`; small, independently owned reusable code lives in `packages/`.

The API is a modular monolith. Its `modules/` directory establishes domain ownership boundaries for future features (for example, incidents and alerts). Routing and cross-cutting HTTP middleware remain outside those domains. This preserves a simple deployment model while making modules testable and independently evolvable.

MongoDB is the first persistence component because its document model fits the evolving domain while allowing schemas and indexes to be introduced deliberately. Mongoose owns the connection lifecycle in `src/config/database.ts`; domain-owned schemas remain in their respective modules. The API connects to MongoDB before accepting traffic and disconnects after closing its HTTP server. `GET /health` remains process-level, while `GET /health/db` performs a database ping.

Organizations are the tenancy boundary. Each user stores an `organizationId` reference to its organization. Organization slugs are globally unique; user email uniqueness is scoped to an organization, allowing one email to belong to separate organizations in the future.

Authentication is intentionally deferred. The user schema has a `passwordHash` field only to establish the future data shape; no password handling, login flow, authorization checks, or tokens are implemented in this phase. No queues, AI features, third-party integrations, or infrastructure are introduced.
