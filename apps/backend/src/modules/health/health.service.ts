import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';

@Injectable()
export class HealthService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async readiness(): Promise<{ status: 'ok'; checks: { mongodb: 'up' } }> {
    try {
      if (this.connection.readyState !== 1 || !this.connection.db) {
        throw new Error('Not connected');
      }
      await this.connection.db.admin().ping({ timeoutMS: 2000 });
      return { status: 'ok', checks: { mongodb: 'up' } };
    } catch {
      throw new ServiceUnavailableException({
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'Database is unavailable.',
        checks: { mongodb: 'down' },
      });
    }
  }
}
