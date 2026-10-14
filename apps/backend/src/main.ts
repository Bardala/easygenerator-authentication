import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule } from './app.module.js';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { configureApplication } from './app.setup.js';
import { AppConfigurationService } from './modules/configuration/app-configuration.service.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    abortOnError: false,
    bodyParser: false,
  });
  const configuration = app.get(AppConfigurationService);

  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  configureApplication(app);
  app.enableShutdownHooks();

  await app.listen(configuration.port, '127.0.0.1');
}

void bootstrap().catch((error: unknown) => {
  // Configuration or connection errors must not disclose secrets.
  const message =
    error instanceof Error && error.message.startsWith('Invalid environment:')
      ? error.message
      : 'Backend startup failed. Check the environment configuration.';
  console.error(message);
  process.exitCode = 1;
});
