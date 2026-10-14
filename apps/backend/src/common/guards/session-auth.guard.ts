import { HttpStatus, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { ApplicationError } from '../errors/application.error.js';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (typeof req.session?.userId !== 'string') {
      throw new ApplicationError(HttpStatus.UNAUTHORIZED, {
        code: 'UNAUTHORIZED',
        message: 'Authentication is required.',
      });
    }
    return true;
  }
}
