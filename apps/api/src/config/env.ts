import { config as loadEnv } from 'dotenv';
import { isIP } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(moduleDirectory, '../../../..');

loadEnv({ path: resolve(repositoryRoot, '.env') });

function parsePort(value: string | undefined): number {
  if (value === undefined || value === '') {
    return 4000;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return port;
}

function required(value: string | undefined, name: string): string {
  if (value === undefined || value.trim() === '') {
    throw new Error(`${name} must be provided when starting the API.`);
  }

  return value;
}

function parseDnsServer(value: string | undefined): string {
  const dnsServer = value?.trim() || '1.1.1.1';

  if (isIP(dnsServer) === 0) {
    throw new Error('MONGODB_DNS_SERVER must be a valid IPv4 or IPv6 address.');
  }

  return dnsServer;
}

export type JwtExpiresIn = `${number}${'s' | 'm' | 'h' | 'd'}`;

function parseJwtExpiresIn(value: string | undefined): JwtExpiresIn {
  const expiresIn = value?.trim() || '1h';

  if (!/^\d+[smhd]$/.test(expiresIn)) {
    throw new Error('JWT_EXPIRES_IN must use a whole number followed by s, m, h, or d.');
  }

  return expiresIn as JwtExpiresIn;
}

export const env = {
  port: parsePort(process.env.PORT),
  redisUrl: required(process.env.REDIS_URL?.trim() || (process.env.NODE_ENV === 'development' ? 'redis://127.0.0.1:6379' : undefined), 'REDIS_URL'),
  mongoDbUri: process.env.NODE_ENV === 'development'
    ? process.env.MONGODB_LOCAL_URI?.trim() || 'mongodb://127.0.0.1:27017/pulseops'
    : required(process.env.MONGODB_URI, 'MONGODB_URI'),
  mongoDbDnsServer: parseDnsServer(process.env.MONGODB_DNS_SERVER),
  jwtSecret: required(process.env.JWT_SECRET, 'JWT_SECRET'),
  jwtExpiresIn: parseJwtExpiresIn(process.env.JWT_EXPIRES_IN),
  githubApiUrl: process.env.GITHUB_API_URL?.trim() || 'https://api.github.com',
  githubToken: process.env.GITHUB_TOKEN?.trim() || undefined,
  githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET?.trim() || undefined,
};
