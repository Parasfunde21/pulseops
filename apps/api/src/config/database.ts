import { logger } from '@pulseops/logger';
import { setServers } from 'node:dns';
import mongoose from 'mongoose';

import { env } from './env.js';

type DiagnosticRecord = Record<string, unknown>;

function asDiagnosticRecord(value: unknown): DiagnosticRecord | undefined {
  return typeof value === 'object' && value !== null ? (value as DiagnosticRecord) : undefined;
}

function redactMongoDbUris(value: string): string {
  return value.replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, '[REDACTED_MONGODB_URI]');
}

function mongoServerSelectionDiagnostics(error: unknown): DiagnosticRecord | undefined {
  const errorRecord = asDiagnosticRecord(error);
  const reason = asDiagnosticRecord(errorRecord?.reason);
  const servers = reason?.servers;

  if (reason === undefined) {
    return undefined;
  }

  const serverEntries =
    servers instanceof Map
      ? Array.from(servers.entries())
      : Object.entries(asDiagnosticRecord(servers) ?? {});

  return {
    type: reason.type,
    setName: reason.setName,
    compatible: reason.compatible,
    stale: reason.stale,
    logicalSessionTimeoutMinutes: reason.logicalSessionTimeoutMinutes,
    servers: serverEntries.map(([address, value]) => {
      const server = asDiagnosticRecord(value);
      const serverError = asDiagnosticRecord(server?.error);

      return {
        address,
        type: server?.type,
        error: serverError?.message === undefined ? undefined : redactMongoDbUris(String(serverError.message)),
        roundTripTime: server?.roundTripTime,
        minWireVersion: server?.minWireVersion,
        maxWireVersion: server?.maxWireVersion,
      };
    }),
  };
}

function connectionFailureCategory(error: unknown): string {
  const message = error instanceof Error ? error.message : '';

  if (/authentication|auth failed/i.test(message)) {
    return 'authentication';
  }

  if (/dns|enotfound|querysrv|srv/i.test(message)) {
    return 'dns';
  }

  if (/tls|ssl|certificate/i.test(message)) {
    return 'tls';
  }

  if (/timeout|timed out|etimedout|econnrefused|network/i.test(message)) {
    return 'network';
  }

  return 'unknown';
}

export async function connectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === mongoose.ConnectionStates.connected) {
    return;
  }

  logger.info('Connecting to MongoDB');

  try {
    if (env.mongoDbUri.startsWith('mongodb+srv://')) {
      setServers([env.mongoDbDnsServer]);
    }
    await mongoose.connect(env.mongoDbUri);
    logger.info('Connected to MongoDB');
  } catch (error) {
    logger.error('MongoDB connection failed', {
      error: error instanceof Error ? error.name : 'UnknownError',
      message: redactMongoDbUris(error instanceof Error ? error.message : String(error)),
      category: connectionFailureCategory(error),
      reason: mongoServerSelectionDiagnostics(error),
    });
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === mongoose.ConnectionStates.disconnected) {
    return;
  }

  await mongoose.disconnect();
  logger.info('Disconnected from MongoDB');
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}

export async function isDatabaseReachable(): Promise<boolean> {
  if (!isDatabaseConnected() || mongoose.connection.db === undefined) {
    return false;
  }

  try {
    await mongoose.connection.db.admin().ping();
    return true;
  } catch (error) {
    logger.error('MongoDB health check failed', {
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    return false;
  }
}
