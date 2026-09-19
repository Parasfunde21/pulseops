FROM node:20-alpine

WORKDIR /app

RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/logger/package.json packages/logger/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN pnpm install --frozen-lockfile --prod=false

COPY . .
RUN pnpm --filter @pulseops/logger build
RUN pnpm --filter @pulseops/api build

EXPOSE 4000
CMD ["pnpm", "--filter", "@pulseops/api", "start"]