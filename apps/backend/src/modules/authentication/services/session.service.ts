import { HttpStatus, Injectable } from '@nestjs/common';
import session from 'express-session';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { ApplicationError } from '../../../common/errors/application.error.js';
import type {} from '../../../common/types/session.js';
import { AppConfigurationService } from '../../configuration/app-configuration.service.js';
import { CsrfService } from './csrf.service.js';
import { MongoSessionAdapter } from '../adapters/mongo-session.adapter.js';

export const SESSION_IDLE_MS = 30 * 60 * 1000;
export const SESSION_ABSOLUTE_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class SessionService {
  private readonly handler: RequestHandler;
  readonly cookieName: string;

  constructor(
    private readonly persistence: MongoSessionAdapter,
    private readonly configuration: AppConfigurationService,
    private readonly csrf: CsrfService,
  ) {
    this.cookieName = configuration.production ? '__Host-eg.sid' : 'eg.sid';
    const store = persistence.createStore(SESSION_IDLE_MS / 1000);
    this.handler = session({
      name: this.cookieName,
      secret: configuration.sessionSecret,
      store,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: { ...this.cookieOptions(), maxAge: SESSION_IDLE_MS },
    });
  }

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');
    try {
      await this.persistence.ensureReady();
      await new Promise<void>((resolve, reject) =>
        this.handler(req, res, (error) => (error ? reject(error) : resolve())),
      );
      if (req.session.userId) {
        const now = Date.now();
        const { createdAt, lastSeenAt } = req.session;
        if (
          typeof createdAt !== 'number' ||
          typeof lastSeenAt !== 'number' ||
          !Number.isFinite(createdAt) ||
          !Number.isFinite(lastSeenAt) ||
          now - lastSeenAt >= SESSION_IDLE_MS ||
          now - createdAt >= SESSION_ABSOLUTE_MS ||
          !(await this.persistence.renew(req.sessionID, now))
        ) {
          await this.destroy(req, res);
          next(
            new ApplicationError(HttpStatus.UNAUTHORIZED, {
              code: 'SESSION_EXPIRED',
              message: 'Your session has expired. Please sign in again.',
            }),
          );
          return;
        }
        // Changing only cookie metadata avoids a full save of stale session data.
        req.session.cookie.maxAge = Math.min(
          SESSION_IDLE_MS,
          SESSION_ABSOLUTE_MS - (now - createdAt),
        );
      }
      next();
    } catch (cause: unknown) {
      next(
        cause instanceof ApplicationError
          ? cause
          : this.persistence.unavailable(cause),
      );
    }
  }

  async establish(req: Request, userId: string): Promise<string> {
    await this.invoke(req, 'regenerate');
    req.session.userId = userId;
    req.session.createdAt = req.session.lastSeenAt = Date.now();
    const csrfToken = this.csrf.token(req, true);
    await this.save(req);
    return csrfToken;
  }
  save(req: Request): Promise<void> {
    return this.invoke(req, 'save');
  }
  async destroy(req: Request, res: Response): Promise<void> {
    await this.invoke(req, 'destroy');
    res.clearCookie(this.cookieName, this.cookieOptions());
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: this.configuration.production,
      sameSite: 'lax' as const,
      path: '/',
    };
  }
  private invoke(
    req: Request,
    method: 'save' | 'regenerate' | 'destroy',
  ): Promise<void> {
    return new Promise<void>((resolve, reject) =>
      req.session[method]((error) => (error ? reject(error) : resolve())),
    ).catch((cause) => {
      throw this.persistence.unavailable(cause);
    });
  }
}
