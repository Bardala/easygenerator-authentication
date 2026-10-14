import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppConfigurationService } from './modules/configuration/app-configuration.service.js';
import { RequestLoggingMiddleware } from './common/middleware/request-logging.middleware.js';
import { createApiValidationPipe } from './common/pipes/api-validation.pipe.js';
import { SessionService } from './modules/authentication/services/session.service.js';

export function configureApplication(app: NestExpressApplication): void {
  const configuration = app.get(AppConfigurationService);
  const logging = app.get(RequestLoggingMiddleware);
  const sessions = app.get(SessionService);
  app.set('trust proxy', configuration.trustProxyHops);
  app.setGlobalPrefix('api');
  app.use(logging.use.bind(logging));
  // Retain CSP for API responses; only local Swagger needs inline scripts.
  app.use(
    helmet(
      configuration.production
        ? {}
        : {
            strictTransportSecurity: false,
          },
    ),
  );
  app.useBodyParser('json', { limit: '16kb' });
  app.useGlobalPipes(createApiValidationPipe());
  app.use('/api/auth', sessions.use.bind(sessions));

  if (!configuration.production) {
    app.use('/api/docs', (_req: Request, res: Response, next: NextFunction) => {
      res.removeHeader('Content-Security-Policy');
      next();
    });
    const definition = new DocumentBuilder()
      .setTitle('Authentication API')
      .setVersion('1.0')
      .addCookieAuth(sessions.cookieName)
      .build();
    const document = SwaggerModule.createDocument(app, definition);
    SwaggerModule.setup('api/docs', app, document);
  }
}
