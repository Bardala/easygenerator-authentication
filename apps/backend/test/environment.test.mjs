import { expect, test } from '@jest/globals';
import { validateEnvironment } from '../dist/modules/configuration/environment.js';
const environment = {
  APP_ENV: 'test',
  APP_ORIGIN: 'http://127.0.0.1:5173',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/test',
  SESSION_SECRET: 'test-only-secret-0123456789-0123456789',
};
test('network binding defaults to loopback and explicitly allows container binding', () => {
  expect(validateEnvironment(environment).HOST).toBe('127.0.0.1');
  expect(validateEnvironment({ ...environment, HOST: '0.0.0.0' }).HOST).toBe(
    '0.0.0.0',
  );
  expect(() =>
    validateEnvironment({ ...environment, HOST: 'arbitrary-host' }),
  ).toThrow('HOST must be');
});
test('production requires HTTPS even when listening on container interfaces', () => {
  expect(() =>
    validateEnvironment({
      ...environment,
      APP_ENV: 'production',
      HOST: '0.0.0.0',
    }),
  ).toThrow('requires HTTPS');
  expect(
    validateEnvironment({
      ...environment,
      APP_ENV: 'production',
      HOST: '0.0.0.0',
      APP_ORIGIN: 'https://example.com',
      TRUST_PROXY_HOPS: '1',
    }).TRUST_PROXY_HOPS,
  ).toBe(1);
});
