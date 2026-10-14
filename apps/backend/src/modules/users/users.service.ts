import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import type { Model } from 'mongoose';
import { ApplicationError } from '../../common/errors/application.error.js';
import { USER_MODEL } from './schemas/user.schema.js';
import type { UserRecord } from './types/user.js';
import type { UserResDto } from './dtos/user-res.dto.js';

@Injectable()
export class UsersService {
  private indexReady: Promise<unknown> | undefined;

  constructor(
    @InjectModel(USER_MODEL) private readonly users: Model<UserRecord>,
  ) {
    this.users.db.on('connected', () => {
      this.indexReady = undefined;
    });
  }

  async create(
    email: string,
    name: string,
    passwordHash: string,
  ): Promise<UserResDto> {
    await this.ensureReady();
    const user = await this.users
      .create({ email, name, passwordHash })
      .catch((cause) => this.persistenceFailure(cause));
    return this.publicUser(user);
  }

  async findCredentials(email: string): Promise<UserRecord | null> {
    await this.ensureReady();
    return this.users
      .findOne({ email })
      .select('+passwordHash')
      .exec()
      .catch((cause) => this.persistenceFailure(cause));
  }

  async findPublic(id: string): Promise<UserResDto | null> {
    if (!mongoose.isObjectIdOrHexString(id)) return null;
    await this.ensureReady();
    const user = await this.users
      .findById(id)
      .exec()
      .catch((cause) => this.persistenceFailure(cause));
    return user ? this.publicUser(user) : null;
  }

  private async ensureReady(): Promise<void> {
    if (this.users.db.readyState !== 1) this.persistenceFailure(undefined);
    this.indexReady ??= this.users.createIndexes().catch((cause) => {
      this.indexReady = undefined;
      return this.persistenceFailure(cause);
    });
    await this.indexReady;
  }

  private publicUser(user: UserRecord): UserResDto {
    return { id: user._id.toString(), email: user.email, name: user.name };
  }

  private persistenceFailure(cause: unknown): never {
    if (
      cause instanceof mongoose.mongo.MongoServerError &&
      cause.code === 11000
    ) {
      throw new ApplicationError(HttpStatus.CONFLICT, {
        code: 'ACCOUNT_CONFLICT',
        message: 'An account with these details already exists.',
      });
    }
    throw new ApplicationError(
      HttpStatus.SERVICE_UNAVAILABLE,
      {
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'Database is unavailable.',
      },
      { cause },
    );
  }
}
