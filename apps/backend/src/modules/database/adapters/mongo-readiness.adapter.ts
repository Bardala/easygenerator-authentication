import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { ApplicationError } from '../../../common/errors/application.error.js';
import type { ApiErrorRes } from '../../../common/types/api.js';

// Database details stay here; the health module owns its outward response type.
interface MongoUnavailableRes extends ApiErrorRes {
  code: 'DEPENDENCY_UNAVAILABLE';
  checks: { mongodb: 'down' };
}

@Injectable()
export class MongoReadinessAdapter {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async assertAvailable(): Promise<void> {
    if (this.connection.readyState !== 1 || !this.connection.db) {
      throw this.unavailable();
    }

    try {
      await this.connection.db.admin().ping({ timeoutMS: 2000 });
    } catch (cause: unknown) {
      throw this.unavailable(cause);
    }
  }

  private unavailable(cause?: unknown): ApplicationError<MongoUnavailableRes> {
    return new ApplicationError<MongoUnavailableRes>(
      HttpStatus.SERVICE_UNAVAILABLE,
      {
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'Database is unavailable.',
        checks: { mongodb: 'down' },
      },
      { cause },
    );
  }
}
