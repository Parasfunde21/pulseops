import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';

import { env } from '../../config/env.js';
import { UserModel, type UserDocument } from '../users/index.js';

const PASSWORD_SALT_ROUNDS = 12;

export interface RegisterUserInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginUserInput {
  email: string;
  password: string;
}

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthenticationResult {
  accessToken: string;
  user: SafeUser;
}

export class EmailAlreadyRegisteredError extends Error {
  public constructor() {
    super('A user with this email already exists.');
  }
}

function toSafeUser(user: UserDocument): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function createAccessToken(user: UserDocument): string {
  const options: SignOptions = {
    subject: user.id,
    expiresIn: env.jwtExpiresIn,
  };

  return jwt.sign({}, env.jwtSecret, options);
}

export async function registerUser(input: RegisterUserInput): Promise<AuthenticationResult> {
  const existingUser = await UserModel.exists({ email: input.email });
  if (existingUser !== null) {
    throw new EmailAlreadyRegisteredError();
  }

  const passwordHash = await bcrypt.hash(input.password, PASSWORD_SALT_ROUNDS);

  try {
    const user = await UserModel.create({
      name: input.name,
      email: input.email,
      passwordHash,
    });

    return {
      accessToken: createAccessToken(user),
      user: toSafeUser(user),
    };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new EmailAlreadyRegisteredError();
    }

    throw error;
  }
}

export async function loginUser(input: LoginUserInput): Promise<AuthenticationResult | null> {
  const user = await UserModel.findOne({ email: input.email }).exec();
  if (user === null) {
    return null;
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatches) {
    return null;
  }

  return {
    accessToken: createAccessToken(user),
    user: toSafeUser(user),
  };
}

export async function getSafeUserById(userId: string): Promise<SafeUser | null> {
  const user = await UserModel.findById(userId).exec();
  return user === null ? null : toSafeUser(user);
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'number' &&
    error.code === 11000
  );
}
