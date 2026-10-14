import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from './environment.js';

@Injectable()
export class AppConfigurationService {
  constructor(
    private readonly configuration: ConfigService<Environment, true>,
  ) {}

  get port(): number {
    return this.configuration.get('PORT', { infer: true });
  }

  get mongoUri(): string {
    return this.configuration.get('MONGODB_URI', { infer: true });
  }

  get logLevel(): Environment['LOG_LEVEL'] {
    return this.configuration.get('LOG_LEVEL', { infer: true });
  }
}
