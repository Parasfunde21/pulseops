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

export const env = {
  port: parsePort(process.env.PORT),
  mongoDbUri: required(process.env.MONGODB_URI, 'MONGODB_URI'),
  mongoDbDnsServer: parseDnsServer(process.env.MONGODB_DNS_SERVER),
};
