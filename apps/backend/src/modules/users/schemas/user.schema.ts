import mongoose from 'mongoose';
import type { UserRecord } from '../types/user.js';

export const USER_MODEL = 'User';
export const UserSchema = new mongoose.Schema<UserRecord>(
  {
    email: { type: String, required: true, maxlength: 254 },
    name: { type: String, required: true, minlength: 3, maxlength: 100 },
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true, autoIndex: false, bufferCommands: false },
);
UserSchema.index({ email: 1 }, { unique: true });
