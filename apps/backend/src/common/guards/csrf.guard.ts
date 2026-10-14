import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { CsrfService } from '../../modules/authentication/services/csrf.service.js';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly csrf: CsrfService) {}

  canActivate(context: ExecutionContext): boolean {
    this.csrf.assertValid(context.switchToHttp().getRequest<Request>());
    return true;
  }
}
