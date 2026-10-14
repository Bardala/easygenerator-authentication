import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { Request } from 'express';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'general',
          ttl: 60_000,
          limit: 100,
          generateKey: (_context, tracker, name) => `${name}:${tracker}`,
        },
        {
          name: 'auth',
          ttl: 60_000,
          limit: 10,
          generateKey: (_context, tracker, name) => `${name}:${tracker}`,
          skipIf: (context) => {
            const req = context.switchToHttp().getRequest<Request>();
            return (
              req.method !== 'POST' ||
              !['/api/auth/sign-in', '/api/auth/sign-up'].includes(req.path)
            );
          },
        },
      ],
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class RateLimitingModule {}
