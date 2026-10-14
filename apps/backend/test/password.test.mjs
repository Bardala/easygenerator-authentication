import 'reflect-metadata';
import { beforeEach, expect, jest, test } from '@jest/globals';

const hash = jest.fn();
const verify = jest.fn();
jest.unstable_mockModule('argon2', () => ({ argon2id: 2, hash, verify }));
const { PasswordService } =
  await import('../dist/modules/authentication/services/password.service.js');

beforeEach(() => {
  hash.mockReset().mockResolvedValue('dummy-encoded-hash');
  verify.mockReset().mockResolvedValue(true);
});

test('unknown accounts perform hash verification but can never authenticate', async () => {
  const service = new PasswordService();
  await service.onModuleInit();
  await expect(service.verify(undefined, 'submitted-password')).resolves.toBe(
    false,
  );
  expect(verify).toHaveBeenCalledWith(
    'dummy-encoded-hash',
    'submitted-password',
  );
});

test('existing accounts use their stored hash and preserve the submitted password', async () => {
  const service = new PasswordService();
  await service.onModuleInit();
  await expect(
    service.verify('account-hash', ' unchanged password '),
  ).resolves.toBe(true);
  expect(verify).toHaveBeenCalledWith('account-hash', ' unchanged password ');
  verify.mockResolvedValueOnce(false);
  await expect(service.verify('account-hash', 'incorrect')).resolves.toBe(
    false,
  );
});
