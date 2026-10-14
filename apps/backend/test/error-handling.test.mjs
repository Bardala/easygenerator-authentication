import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Module,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

const privateMessage =
  'mongodb://private-user:private-password@example.com/database';
const logger = { error: jest.fn() };
const database = { assertAvailable: jest.fn() };

// Isolate the logging transport: its CommonJS adapter cannot require Nest ESM
// inside Jest's VM loader. Application error handling and HTTP remain real.
const WINSTON_MODULE_PROVIDER = 'winston';
class TestWinstonModule {
  static forRootAsync() {
    return {
      global: true,
      module: TestWinstonModule,
      providers: [{ provide: WINSTON_MODULE_PROVIDER, useValue: logger }],
      exports: [WINSTON_MODULE_PROVIDER],
    };
  }
}
Module({})(TestWinstonModule);
jest.unstable_mockModule('nest-winston', () => ({
  WINSTON_MODULE_PROVIDER,
  WinstonModule: TestWinstonModule,
}));

const { CommonModule } = await import('../dist/common/common.module.js');
const { ApplicationError } =
  await import('../dist/common/errors/application.error.js');
const { MongoReadinessAdapter } =
  await import('../dist/modules/database/adapters/mongo-readiness.adapter.js');
const { HealthController } =
  await import('../dist/modules/health/health.controller.js');
const { HealthService } =
  await import('../dist/modules/health/health.service.js');

class FailureController {
  unexpected() {
    throw new Error(privateMessage);
  }
  knownHttp() {
    throw new HttpException(privateMessage, HttpStatus.BAD_REQUEST);
  }
}
Controller('test')(FailureController);
Get('unexpected')(
  FailureController.prototype,
  'unexpected',
  Object.getOwnPropertyDescriptor(FailureController.prototype, 'unexpected'),
);
Get('known-http')(
  FailureController.prototype,
  'knownHttp',
  Object.getOwnPropertyDescriptor(FailureController.prototype, 'knownHttp'),
);

class TestAppModule {}
Module({
  imports: [CommonModule],
  controllers: [HealthController, FailureController],
  providers: [
    HealthService,
    { provide: MongoReadinessAdapter, useValue: database },
  ],
})(TestAppModule);

describe('global HTTP error boundary', () => {
  let app;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [TestAppModule] })
      .overrideProvider(WINSTON_MODULE_PROVIDER)
      .useValue(logger)
      .compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    app.use('/api/test/middleware', (_req, _res, next) =>
      next(Object.assign(new Error(privateMessage), { status: 403 })),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('preserves the successful health payload', async () => {
    database.assertAvailable.mockResolvedValueOnce(undefined);
    const res = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);
    expect(res.body).toEqual({ status: 'ok', checks: { mongodb: 'up' } });
  });

  it('preserves the public dependency failure without exposing its cause', async () => {
    database.assertAvailable.mockRejectedValueOnce(
      new ApplicationError(
        503,
        {
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'Database is unavailable.',
          checks: { mongodb: 'down' },
        },
        { cause: new Error(privateMessage) },
      ),
    );
    const res = await request(app.getHttpServer())
      .get('/api/health')
      .expect(503);
    expect(res.body).toEqual({
      code: 'DEPENDENCY_UNAVAILABLE',
      message: 'Database is unavailable.',
      checks: { mongodb: 'down' },
    });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(
      privateMessage,
    );
  });

  it('sanitizes unexpected controller errors', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/test/unexpected')
      .expect(500);
    expect(res.body).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    });
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(
      privateMessage,
    );
  });

  it('does not trust arbitrary HttpException messages', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/test/known-http')
      .expect(400);
    expect(res.body).toEqual({
      code: 'BAD_REQUEST',
      message: 'Invalid request.',
    });
  });

  it('handles Express middleware errors through the same filter', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/test/middleware')
      .expect(403);
    expect(res.body).toEqual({
      code: 'FORBIDDEN',
      message: 'The request is not permitted.',
    });
  });

  it('sanitizes malformed JSON rejected before the controller', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"password":"private-password",')
      .expect(400);
    expect(res.body).toEqual({
      code: 'BAD_REQUEST',
      message: 'Invalid request.',
    });
  });

  it('returns a consistent 404 without echoing the requested path', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/private-password')
      .expect(404);
    expect(res.body).toEqual({
      code: 'NOT_FOUND',
      message: 'The requested resource was not found.',
    });
  });
});

describe('MongoDB readiness boundary', () => {
  it('reports a disconnected database without calling its driver', async () => {
    const ping = jest.fn();
    const adapter = new MongoReadinessAdapter({
      readyState: 0,
      db: { admin: () => ({ ping }) },
    });
    await expect(adapter.assertAvailable()).rejects.toMatchObject({
      statusCode: 503,
      res: { code: 'DEPENDENCY_UNAVAILABLE' },
    });
    expect(ping).not.toHaveBeenCalled();
  });

  it('translates a connected driver ping failure and retains the cause internally', async () => {
    const cause = new Error(privateMessage);
    const adapter = new MongoReadinessAdapter({
      readyState: 1,
      db: { admin: () => ({ ping: jest.fn().mockRejectedValue(cause) }) },
    });
    await expect(adapter.assertAvailable()).rejects.toMatchObject({
      statusCode: 503,
      cause,
      res: { code: 'DEPENDENCY_UNAVAILABLE' },
    });
  });
});
