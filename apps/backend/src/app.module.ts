import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module.js';
import { RateLimitingModule } from './common/rate-limiting.module.js';
import { AuthenticationModule } from './modules/authentication/authentication.module.js';
import { AppConfigurationModule } from './modules/configuration/app-configuration.module.js';
import { DatabaseModule } from './modules/database/database.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { LoggingModule } from './modules/logging/logging.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    RateLimitingModule,
    AppConfigurationModule,
    LoggingModule,
    CommonModule,
    DatabaseModule,
    HealthModule,
    UsersModule,
    AuthenticationModule,
  ],
})
export class AppModule {}
