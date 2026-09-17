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
- Docker Desktop (for the local MongoDB service)

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

## Current scope

This foundation deliberately does not include authentication, persistence, queues, AI features, cloud provisioning, containerization, monitoring integrations, or external product integrations. Those will be added incrementally as their product boundaries are defined.
