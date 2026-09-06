import type { RequestHandler } from 'express';

import {
  createOrganization,
  organizationById,
  organizationResponse,
  organizationsForUser,
  SlugAlreadyExistsError,
} from './service.js';

function nameFromBody(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const name = (value as Record<string, unknown>).name;
  return typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 120 ? name.trim() : null;
}

export const create: RequestHandler = async (request, response, next) => {
  const name = nameFromBody(request.body);
  if (request.auth === undefined) return void response.status(401).json({ error: 'Unauthorized' });
  if (name === null) return void response.status(400).json({ error: 'Invalid organization name.' });
  try {
    const organization = await createOrganization(name, request.auth.userId);
    if (organization === null) return void response.status(400).json({ error: 'Invalid organization name.' });
    response.status(201).json({ organization: organizationResponse(organization) });
  } catch (error) {
    if (error instanceof SlugAlreadyExistsError) return void response.status(409).json({ error: 'Organization slug is already in use.' });
    next(error);
  }
};

export const list: RequestHandler = async (request, response, next) => {
  if (request.auth === undefined) return void response.status(401).json({ error: 'Unauthorized' });
  try {
    response.status(200).json({ organizations: await organizationsForUser(request.auth.userId) });
  } catch (error) { next(error); }
};

export const get: RequestHandler = async (request, response, next) => {
  try {
    const organization = await organizationById(request.organization!.organizationId);
    if (organization === null) return void response.status(404).json({ error: 'Organization not found.' });
    response.status(200).json({ organization: organizationResponse(organization) });
  } catch (error) { next(error); }
};
