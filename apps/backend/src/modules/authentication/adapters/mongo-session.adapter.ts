import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import MongoStore from 'connect-mongo';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import type { SessionData } from 'express-session';
import { ApplicationError } from '../../../common/errors/application.error.js';

interface StoredSession {
  _id: string;
  session: SessionData;
  expires: Date;
}

@Injectable()
export class MongoSessionAdapter {
  private indexReady: Promise<unknown> | undefined;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    connection.on('connected', () => {
      this.indexReady = undefined;
    });
  }

  createStore(ttlSeconds: number): MongoStore {
    const store = MongoStore.create({
      client: this.connection.getClient(),
      collectionName: 'sessions',
      autoRemove: 'disabled',
      stringify: false,
      ttl: ttlSeconds,
    });
    store.on('error', () =>
      this.logger.error('Session store unavailable', { context: 'Sessions' }),
    );
    return store;
  }

  async ensureReady(): Promise<void> {
    if (this.connection.readyState !== 1 || !this.connection.db)
      throw this.unavailable();
    this.indexReady ??= this.connection.db
      .collection('sessions')
      .createIndex({ expires: 1 }, { expireAfterSeconds: 0 })
      .catch((cause) => {
        this.indexReady = undefined;
        throw this.unavailable(cause);
      });
    await this.indexReady;
  }

  async renew(id: string, now: number): Promise<boolean> {
    await this.ensureReady();
    // Never upsert: a request completing around logout must not recreate a session.
    const result = await this.connection
      .db!.collection<StoredSession>('sessions')
      .updateOne({ _id: id }, { $max: { 'session.lastSeenAt': now } })
      .catch((cause) => {
        throw this.unavailable(cause);
      });
    return result.matchedCount === 1;
  }

  unavailable(cause?: unknown): ApplicationError {
    return new ApplicationError(
      HttpStatus.SERVICE_UNAVAILABLE,
      {
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'Session storage is unavailable.',
      },
      { cause },
    );
  }
}
