import { HttpStatus, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { ApplicationError } from '../errors/application.error.js';

@Injectable()
export class EmptyBodyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const body: unknown = context.switchToHttp().getRequest<Request>().body;
    if (
      body === undefined ||
      (body !== null &&
        typeof body === 'object' &&
        !Array.isArray(body) &&
        Object.keys(body).length === 0)
    )
      return true;
    throw new ApplicationError(HttpStatus.BAD_REQUEST, {
      code: 'VALIDATION_ERROR',
      message: 'This endpoint accepts no body properties.',
    });
  }
}
