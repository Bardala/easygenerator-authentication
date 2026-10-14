import { Catch, Inject, Injectable } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';
import { HttpErrorAdapter } from '../adapters/http-error.adapter.js';

@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly errors: HttpErrorAdapter,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<unknown>();
    const { statusCode, res } = this.errors.normalize(exception);
    const adapter = this.adapterHost.httpAdapter;

    if (statusCode >= 500) {
      // Do not serialize exception messages, causes, or request credentials.
      this.logger.error('HTTP request failed', {
        context: 'HttpErrors',
        statusCode,
        code: res.code,
      });
    }

    if (adapter.isHeadersSent(response)) {
      adapter.end(response);
      return;
    }

    adapter.setHeader(response, 'Cache-Control', 'no-store');
    adapter.reply(response, res, statusCode);
  }
}
