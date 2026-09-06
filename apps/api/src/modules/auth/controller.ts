import type { RequestHandler } from 'express';

import {
  EmailAlreadyRegisteredError,
  getSafeUserById,
  loginUser,
  registerUser,
  type LoginUserInput,
  type RegisterUserInput,
} from './service.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,}$/;

function requestBody(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() : null;
}

function registerInput(value: unknown): RegisterUserInput | null {
  const body = requestBody(value);
  if (body === null) {
    return null;
  }

  const name = stringValue(body.name);
  const email = stringValue(body.email)?.toLowerCase();
  const password = typeof body.password === 'string' ? body.password : null;

  if (name === null || name.length === 0 || email === undefined || !EMAIL_PATTERN.test(email)) {
    return null;
  }

  if (password === null || !PASSWORD_PATTERN.test(password)) {
    return null;
  }

  return { name, email, password };
}

function loginInput(value: unknown): LoginUserInput | null {
  const body = requestBody(value);
  if (body === null) {
    return null;
  }

  const email = stringValue(body.email)?.toLowerCase();
  const password = typeof body.password === 'string' ? body.password : null;

  if (email === undefined || !EMAIL_PATTERN.test(email) || password === null) {
    return null;
  }

  return { email, password };
}

export const register: RequestHandler = async (request, response, next) => {
  const input = registerInput(request.body as unknown);
  if (input === null) {
    response.status(400).json({ error: 'Invalid registration data.' });
    return;
  }

  try {
    const result = await registerUser(input);
    response.status(201).json(result);
  } catch (error) {
    if (error instanceof EmailAlreadyRegisteredError) {
      response.status(409).json({ error: 'Unable to register with these details.' });
      return;
    }

    next(error);
  }
};

export const login: RequestHandler = async (request, response, next) => {
  const input = loginInput(request.body as unknown);
  if (input === null) {
    response.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  try {
    const result = await loginUser(input);
    if (result === null) {
      response.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const me: RequestHandler = async (request, response, next) => {
  if (request.auth === undefined) {
    response.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const user = await getSafeUserById(request.auth.userId);
    if (user === null) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    response.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};
