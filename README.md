# PulseOps

PulseOps is a production-oriented portfolio project for AI-powered DevOps observability and incident management. This repository currently contains the Milestone 1 foundation only: a type-safe monorepo, a React web shell, and an Express API shell.

## Repository layout

```text
apps/
  api/                 Express API
  web/                 React + Vite web application
packages/
  config/              Shared TypeScript compiler configuration
  logger/              Minimal structured console logger
  shared-types/        Types safe to share between applications
docs/
  architecture/        Architecture notes
  decisions/           Architecture decision records
```

## Prerequisites

- Node.js 20 or later
- pnpm 9 or later
- Docker Desktop (for local infrastructure and observability)

## Getting started

```bash
pnpm install
cp .env.example .env
docker compose up -d mongodb
pnpm dev
```

The web app is served by Vite (normally at `http://localhost:5173`) and the API listens on `http://localhost:4000` by default. Override the API port with `PORT` in `.env`.

When `NODE_ENV=development`, the API uses `MONGODB_LOCAL_URI`, defaulting to `mongodb://127.0.0.1:27017/pulseops` when it is omitted. This keeps an Atlas `MONGODB_URI` in the root `.env` from being selected during local development. Production environments must provide `MONGODB_URI`; Atlas remains supported there. Use `docker compose down` to stop the local MongoDB service.
## Commands

```bash
pnpm dev            # start all development servers
pnpm lint           # lint the repository
pnpm typecheck      # run strict TypeScript checks
pnpm build          # create production builds
pnpm format:check   # verify formatting
```

## API

`GET /health` returns:

```json
{
  "status": "ok",
  "service": "pulseops-api"
}
```

## Redis and BullMQ

Phase 8 adds Redis as the BullMQ transport while MongoDB remains the primary application database. The API enqueues `system.health-check` jobs on `pulseops-jobs`; the separate worker consumes them and verifies MongoDB and Redis reachability. Jobs retry up to three times with exponential backoff and retain a bounded history of completed and failed jobs.

Start local infrastructure with `docker compose up -d`, then start the API and worker in separate terminals:

```bash
pnpm --filter @pulseops/api build
pnpm --filter @pulseops/api start
pnpm --filter @pulseops/api worker
```

An authenticated `POST /jobs/health-check` returns `202` and a job ID. Poll `GET /jobs/:jobId` to inspect its state and the completed MongoDB/Redis result.

## GitHub integration

PulseOps includes a scoped GitHub integration layer that keeps the rest of the application architecture intact while adding repository inspection and webhook-driven updates.

- `GET /organizations/:organizationId/services/:serviceId/github` validates a GitHub repository URL and returns safe metadata for the repository and recent commits from the GitHub REST API.
- GitHub webhooks are accepted through `POST /webhooks/github/:organizationId`, verified with `X-Hub-Signature-256`, and filtered to supported event types (`push`, `deployment`, and `deployment_status`). Configure each GitHub webhook URL with the PulseOps organization ID. The legacy unscoped `POST /webhooks/github` route rejects queueable events because it cannot establish tenant context.
- Validated webhook events are queued through BullMQ and processed by the worker to match the service registry by repository URL and emit a structured job result without exposing any secrets.

Set the following environment variables in `.env` when enabling the feature:

```bash
GITHUB_API_URL=https://api.github.com
GITHUB_TOKEN=ghp_xxx
GITHUB_WEBHOOK_SECRET=replace-with-your-github-webhook-secret
```

Use a token with the minimum required repository access, and keep the webhook secret in the server environment only. Never expose it in client code or logs.

## Local observability

Set `JWT_SECRET` in `.env` before starting the full Compose stack, then run:

```bash
docker compose up -d
```

The API exposes `GET /ready` for readiness checks of MongoDB and Redis, and `GET /metrics` in Prometheus text exposition format. Prometheus scrapes the API every 15 seconds. Grafana is provisioned with a PulseOps dashboard covering request rate, 5xx error rate, p95 latency, BullMQ throughput/failures, and API readiness.

- Grafana: `http://localhost:3000`
- Prometheus: `http://localhost:9090`
- API metrics: `http://localhost:4000/metrics`
- API readiness: `http://localhost:4000/ready`

The API logs structured method, route, status, duration, and request ID fields. Authorization headers, cookies, bodies, tokens, and secrets are excluded. Metrics use only bounded method, route, status, job name, and job status labels.

## CI/CD

GitHub Actions runs on pull requests and pushes to `main`. CI installs the locked pnpm workspace dependencies, then runs repository lint, typecheck, tests, production builds, Docker Compose configuration validation, and an API Docker image build. The image is built locally in CI as `pulseops-api:ci` and is not pushed to a registry.

To build and run the production API image locally, provide the required runtime environment variables through your shell or an ignored `.env` file, then run:

```bash
docker build -f apps/api/Dockerfile -t pulseops-api:local .
docker run --rm -p 4000:4000 --env-file .env pulseops-api:local
```

For local deployment with MongoDB, Redis, Prometheus, Grafana, and the API, use Docker Compose:

```bash
docker compose up -d
docker compose ps
```

The API requires a JWT signing secret and runtime connection settings for MongoDB and Redis. Optional GitHub and AI integration settings can be supplied through environment variables when those integrations are enabled. Do not commit credentials or secret values.

## Current scope

This foundation includes authentication, persistence, queues, AI features, GitHub integration, and lightweight local observability. Cloud provisioning and external monitoring integrations remain outside the current scope.
