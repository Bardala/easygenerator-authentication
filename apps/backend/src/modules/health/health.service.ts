import { Injectable } from '@nestjs/common';
import { MongoReadinessAdapter } from '../database/adapters/mongo-readiness.adapter.js';
import type { HealthRes } from './types/health.js';

@Injectable()
export class HealthService {
  constructor(private readonly database: MongoReadinessAdapter) {}

  async readiness(): Promise<HealthRes> {
    await this.database.assertAvailable();
    return { status: 'ok', checks: { mongodb: 'up' } };
  }
}
