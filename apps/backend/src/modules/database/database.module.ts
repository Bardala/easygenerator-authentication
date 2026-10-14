import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Connection } from 'mongoose';
import type { Logger } from 'winston';
import { AppConfigurationModule } from '../configuration/app-configuration.module.js';
import { AppConfigurationService } from '../configuration/app-configuration.service.js';
import { LoggingModule } from '../logging/logging.module.js';
import { MongoReadinessAdapter } from './adapters/mongo-readiness.adapter.js';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [AppConfigurationModule, LoggingModule],
      inject: [AppConfigurationService, WINSTON_MODULE_PROVIDER],
      useFactory: (configuration: AppConfigurationService, logger: Logger) => ({
        uri: configuration.mongoUri,
        lazyConnection: true,
        retryAttempts: 0,
        serverSelectionTimeoutMS: 2000,
        connectTimeoutMS: 2000,
        bufferCommands: false,
        connectionFactory: (connection: Connection) => {
          connection.on('connected', () =>
            logger.info('MongoDB connected', { context: 'Database' }),
          );
          connection.on('disconnected', () =>
            logger.warn('MongoDB disconnected', { context: 'Database' }),
          );
          connection.on('error', () =>
            logger.error('MongoDB connection unavailable', {
              context: 'Database',
            }),
          );
          return connection;
        },
      }),
    }),
  ],
  providers: [MongoReadinessAdapter],
  exports: [MongooseModule, MongoReadinessAdapter],
})
export class DatabaseModule {}
