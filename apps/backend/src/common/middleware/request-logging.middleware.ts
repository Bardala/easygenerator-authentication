import { Inject, Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = randomUUID();
    const started = performance.now();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    res.once('finish', () =>
      this.logger.info('HTTP request completed', {
        context: 'HTTP',
        requestId,
        method: req.method,
        statusCode: res.statusCode,
        durationMs: Math.round(performance.now() - started),
      }),
    );
    next();
  }
}
