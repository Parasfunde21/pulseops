# Architecture overview

PulseOps is a pnpm workspace monorepo. Applications live in `apps/`; small, independently owned reusable code lives in `packages/`.

The API is a modular monolith. Its `modules/` directory establishes domain ownership boundaries for future features (for example, incidents and alerts). Routing and cross-cutting HTTP middleware remain outside those domains. This preserves a simple deployment model while making modules testable and independently evolvable.

At this stage no data stores, queues, third-party integrations, or infrastructure are introduced. The only API route is an operational health endpoint.
