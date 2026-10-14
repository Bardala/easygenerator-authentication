import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { LoggingModule } from '../modules/logging/logging.module.js';
import { HttpErrorAdapter } from './adapters/http-error.adapter.js';
import { GlobalExceptionFilter } from './filters/global-exception.filter.js';

@Module({
  imports: [LoggingModule],
  providers: [
    HttpErrorAdapter,
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class CommonModule {}
