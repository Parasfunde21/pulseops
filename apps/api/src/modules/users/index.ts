import { model, Schema, type HydratedDocument } from 'mongoose';

export type UserRole = 'owner' | 'admin' | 'member';

export interface User {
  organizationId?: Schema.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<User>;

const userSchema = new Schema<User>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, default: 'member', enum: ['owner', 'admin', 'member'] },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ organizationId: 1 });

export const UserModel = model<User>('User', userSchema);
