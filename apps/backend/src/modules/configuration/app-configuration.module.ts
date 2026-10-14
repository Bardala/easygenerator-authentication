import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';
import { AppConfigurationService } from './app-configuration.service.js';
import { validateEnvironment } from './environment.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: resolve(import.meta.dirname, '../../../../../.env'),
      cache: true,
      validate: validateEnvironment,
    }),
  ],
  providers: [AppConfigurationService],
  exports: [AppConfigurationService],
})
export class AppConfigurationModule {}
