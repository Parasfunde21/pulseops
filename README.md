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

## Getting started

```bash
pnpm install
cp .env.example .env
pnpm dev
```

The web app is served by Vite (normally at `http://localhost:5173`) and the API listens on `http://localhost:4000` by default. Override the API port with `PORT` in `.env`.

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
