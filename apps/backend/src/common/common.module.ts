import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { LoggingModule } from '../modules/logging/logging.module.js';
import { HttpErrorAdapter } from './adapters/http-error.adapter.js';
import { GlobalExceptionFilter } from './filters/global-exception.filter.js';
import { RequestLoggingMiddleware } from './middleware/request-logging.middleware.js';

@Module({
  imports: [LoggingModule],
  providers: [
    HttpErrorAdapter,
    RequestLoggingMiddleware,
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
  exports: [RequestLoggingMiddleware],
})
export class CommonModule {}
