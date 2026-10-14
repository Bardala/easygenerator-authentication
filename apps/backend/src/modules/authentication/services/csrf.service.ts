import { HttpStatus, Injectable } from '@nestjs/common';
import { csrfSync } from 'csrf-sync';
import type { Request } from 'express';
import { ApplicationError } from '../../../common/errors/application.error.js';
import { AppConfigurationService } from '../../configuration/app-configuration.service.js';

@Injectable()
export class CsrfService {
  private readonly csrf = csrfSync({
    size: 32,
    getTokenFromRequest: (req) =>
      typeof req.headers['x-csrf-token'] === 'string'
        ? req.headers['x-csrf-token']
        : undefined,
  });
  constructor(private readonly configuration: AppConfigurationService) {}

  token(req: Request, rotate = false): string {
    return this.csrf.generateToken(req, rotate);
  }
  assertValid(req: Request): void {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return;
    }
    if (
      req.headers.origin &&
      req.headers.origin !== this.configuration.origin
    ) {
      throw new ApplicationError(HttpStatus.FORBIDDEN, {
        code: 'ORIGIN_NOT_ALLOWED',
        message: 'The request origin is not permitted.',
      });
    }
    if (!this.csrf.isRequestValid(req)) {
      throw new ApplicationError(HttpStatus.FORBIDDEN, {
        code: 'CSRF_INVALID',
        message: 'Refresh the security token and try again.',
      });
    }
    const hasBody =
      Number(req.headers['content-length'] ?? 0) > 0 ||
      req.headers['transfer-encoding'] !== undefined;
    if (hasBody && !req.is('application/json')) {
      throw new ApplicationError(HttpStatus.UNSUPPORTED_MEDIA_TYPE, {
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Use application/json.',
      });
    }
  }
}
