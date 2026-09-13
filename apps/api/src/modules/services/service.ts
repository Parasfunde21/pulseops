import { Types } from 'mongoose';

import { ServiceModel, type ServiceDocument, type ServiceStatus } from './index.js';

export interface ServiceInput {
  name: string;
  slug: string;
  description?: string;
  repositoryUrl?: string;
  environment?: string;
  teamName?: string;
  status?: ServiceStatus;
}
export type ServiceUpdateInput = Partial<ServiceInput>;

export class ServiceSlugAlreadyExistsError extends Error {}

export function serviceResponse(service: ServiceDocument) {
  return {
    id: service.id, name: service.name, slug: service.slug,
    ...(service.description === undefined ? {} : { description: service.description }),
    ...(service.repositoryUrl === undefined ? {} : { repositoryUrl: service.repositoryUrl }),
    ...(service.environment === undefined ? {} : { environment: service.environment }),
    ...(service.teamName === undefined ? {} : { teamName: service.teamName }),
    status: service.status, createdBy: service.createdBy.toString(), createdAt: service.createdAt, updatedAt: service.updatedAt,
  };
}

export async function createService(organizationId: string, userId: string, input: ServiceInput) {
  try {
    return await ServiceModel.create({ organizationId: new Types.ObjectId(organizationId), createdBy: new Types.ObjectId(userId), ...input });
  } catch (error) {
    if (isDuplicateKeyError(error)) throw new ServiceSlugAlreadyExistsError();
    throw error;
  }
}

export async function servicesForOrganization(organizationId: string) {
  return ServiceModel.find({ organizationId: new Types.ObjectId(organizationId) }).sort({ name: 1 }).exec();
}

/** Every resource lookup is tenant-scoped to avoid cross-organization disclosure. */
export async function serviceForOrganization(organizationId: string, serviceId: string) {
  return ServiceModel.findOne({ _id: serviceId, organizationId: new Types.ObjectId(organizationId) }).exec();
}

export async function updateService(service: ServiceDocument, input: ServiceUpdateInput) {
  try {
    service.set(input);
    return await service.save();
  } catch (error) {
    if (isDuplicateKeyError(error)) throw new ServiceSlugAlreadyExistsError();
    throw error;
  }
}

export async function deleteService(service: ServiceDocument) { await service.deleteOne(); }

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}
