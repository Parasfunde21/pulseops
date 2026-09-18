import type { RequestHandler } from 'express';
import { isValidObjectId } from 'mongoose';

import { getRepositoryMetadata, GitHubApiError } from '../../integrations/github/client.js';
import { parseGithubRepositoryUrl } from '../../integrations/github/index.js';
import { slugFromName } from '../organizations/service.js';
import type { ServiceStatus } from './index.js';
import {
  createService, deleteService, serviceForOrganization, serviceResponse, servicesForOrganization,
  ServiceSlugAlreadyExistsError, updateService, type ServiceInput, type ServiceUpdateInput,
} from './service.js';

const statuses: ServiceStatus[] = ['active', 'inactive'];
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function optionalString(value: unknown, maximum: number): string | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maximum ? normalized : null;
}
function validUrl(value: string): boolean {
  try { const url = new URL(value); return url.protocol === 'http:' || url.protocol === 'https:'; } catch { return false; }
}

function parseInput(value: unknown, creating: boolean): ServiceInput | ServiceUpdateInput | null {
  const body = record(value);
  if (body === null) return null;
  const allowed = new Set(['name', 'slug', 'description', 'repositoryUrl', 'environment', 'teamName', 'status']);
  if (Object.keys(body).some((key) => !allowed.has(key))) return null;
  if (!creating && Object.keys(body).length === 0) return null;

  const name = optionalString(body.name, 120);
  if ((creating && (name === undefined || name === null)) || name === null) return null;
  const suppliedSlug = optionalString(body.slug, 80);
  const slug = suppliedSlug === undefined && creating && name !== undefined ? slugFromName(name) : suppliedSlug;
  if (slug === null || (creating && (slug === undefined || slug === '')) || (slug !== undefined && !slugPattern.test(slug))) return null;

  const description = optionalString(body.description, 2000);
  const repositoryUrl = optionalString(body.repositoryUrl, 2048);
  const environment = optionalString(body.environment, 80);
  const teamName = optionalString(body.teamName, 120);
  if (description === null || repositoryUrl === null || environment === null || teamName === null) return null;
  if (repositoryUrl !== undefined && !validUrl(repositoryUrl)) return null;
  const status = body.status;
  if (status !== undefined && (typeof status !== 'string' || !statuses.includes(status as ServiceStatus))) return null;

  return {
    ...(name === undefined ? {} : { name }), ...(slug === undefined ? {} : { slug }),
    ...(description === undefined ? {} : { description }), ...(repositoryUrl === undefined ? {} : { repositoryUrl }),
    ...(environment === undefined ? {} : { environment }), ...(teamName === undefined ? {} : { teamName }),
    ...(status === undefined ? {} : { status: status as ServiceStatus }),
  };
}

function serviceId(request: Parameters<RequestHandler>[0]): string | null {
  const value = request.params.serviceId;
  return typeof value === 'string' && isValidObjectId(value) ? value : null;
}
function notFound(response: Parameters<RequestHandler>[1]): void { response.status(404).json({ error: 'Service not found.' }); }

export const create: RequestHandler = async (request, response, next) => {
  const input = parseInput(request.body, true);
  if (input === null || request.auth === undefined) return void response.status(input === null ? 400 : 401).json({ error: input === null ? 'Invalid service data.' : 'Unauthorized' });
  try {
    const service = await createService(request.organization!.organizationId, request.auth.userId, input as ServiceInput);
    response.status(201).json({ service: serviceResponse(service) });
  } catch (error) {
    if (error instanceof ServiceSlugAlreadyExistsError) return void response.status(409).json({ error: 'Service slug is already in use.' });
    next(error);
  }
};

export const list: RequestHandler = async (request, response, next) => {
  try { response.status(200).json({ services: (await servicesForOrganization(request.organization!.organizationId)).map(serviceResponse) }); }
  catch (error) { next(error); }
};

export const get: RequestHandler = async (request, response, next) => {
  const id = serviceId(request);
  if (id === null) return notFound(response);
  try { const service = await serviceForOrganization(request.organization!.organizationId, id); if (service === null) return notFound(response); response.status(200).json({ service: serviceResponse(service) }); }
  catch (error) { next(error); }
};

export const update: RequestHandler = async (request, response, next) => {
  const id = serviceId(request); const input = parseInput(request.body, false);
  if (id === null) return notFound(response);
  if (input === null) return void response.status(400).json({ error: 'Invalid service data.' });
  try {
    const service = await serviceForOrganization(request.organization!.organizationId, id);
    if (service === null) return notFound(response);
    response.status(200).json({ service: serviceResponse(await updateService(service, input)) });
  } catch (error) {
    if (error instanceof ServiceSlugAlreadyExistsError) return void response.status(409).json({ error: 'Service slug is already in use.' });
    next(error);
  }
};

export const githubRepository: RequestHandler = async (request, response, next) => {
  const id = serviceId(request);
  if (id === null) return notFound(response);

  try {
    const service = await serviceForOrganization(request.organization!.organizationId, id);
    if (service === null) return notFound(response);
    if (service.repositoryUrl === undefined || service.repositoryUrl.trim() === '') {
      response.status(400).json({ error: 'This service does not have a repository URL configured.' });
      return;
    }

    const repositoryReference = parseGithubRepositoryUrl(service.repositoryUrl);
    if (repositoryReference === null) {
      response.status(400).json({ error: 'Repository URL must point to a valid GitHub repository.' });
      return;
    }

    const repository = await getRepositoryMetadata(repositoryReference.owner, repositoryReference.repo);
    response.status(200).json({
      repository: {
        fullName: repository.fullName,
        private: repository.private,
        defaultBranch: repository.defaultBranch,
        htmlUrl: repository.htmlUrl,
        description: repository.description,
        stars: repository.stars,
        openIssues: repository.openIssues,
      },
    });
  } catch (error) {
    if (error instanceof GitHubApiError) {
      response.status(error.status === 404 ? 404 : 502).json({ error: 'GitHub repository could not be retrieved.' });
      return;
    }

    next(error);
  }
};

export const remove: RequestHandler = async (request, response, next) => {
  const id = serviceId(request);
  if (id === null) return notFound(response);
  try { const service = await serviceForOrganization(request.organization!.organizationId, id); if (service === null) return notFound(response); await deleteService(service); response.status(204).send(); }
  catch (error) { next(error); }
};
