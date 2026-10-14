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

  get origin(): string {
    return this.configuration.get('APP_ORIGIN', { infer: true });
  }
  get sessionSecret(): string {
    return this.configuration.get('SESSION_SECRET', { infer: true });
  }
  get production(): boolean {
    return this.configuration.get('APP_ENV', { infer: true }) === 'production';
  }
  get trustProxyHops(): number {
    return this.configuration.get('TRUST_PROXY_HOPS', { infer: true });
  }
}
