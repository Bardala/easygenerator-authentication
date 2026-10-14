import { Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { format, transports } from 'winston';
import { AppConfigurationModule } from '../configuration/app-configuration.module.js';
import { AppConfigurationService } from '../configuration/app-configuration.service.js';

@Module({
  imports: [
    WinstonModule.forRootAsync({
      imports: [AppConfigurationModule],
      inject: [AppConfigurationService],
      useFactory: (configuration: AppConfigurationService) => ({
        level: configuration.logLevel,
        format: format.combine(format.timestamp(), format.json()),
        transports: [new transports.Console()],
      }),
    }),
  ],
  exports: [WinstonModule],
})
export class LoggingModule {}
