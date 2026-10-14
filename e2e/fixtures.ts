import { test as base, expect } from '@playwright/test';
import { fork, spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { resolve } from 'node:path';

type Runtime = {
  url: string;
  command: (command: string | Record<string, string>) => Promise<void>;
  message: () => Promise<void>;
};
async function message(child: ChildProcess): Promise<void> {
  await Promise.race([
    once(child, 'message'),
    new Promise<never>((_, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Backend test control timed out.')),
        10_000,
      );
      timer.unref();
    }),
  ]);
}
async function stop(child: ChildProcess, ipc = false): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exit = once(child, 'exit');
  const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
  if (ipc && child.connected) child.send('stop');
  else child.kill('SIGTERM');
  try {
    await exit;
  } finally {
    clearTimeout(timer);
  }
}
let nextIp = 1;
export const test = base.extend<{ testIp: string }, { runtime: Runtime }>({
  testIp: async ({}, use) => {
    await use(`198.51.100.${nextIp++}`);
  },
  runtime: [
    async ({}, use) => {
      const url = 'http://127.0.0.1:4174';
      const backend = fork(
        resolve('apps/backend/test/fixtures/auth-server.mjs'),
        [],
        {
          execArgv: [],
          stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
          env: {
            ...process.env,
            NODE_OPTIONS: '',
            APP_ENV: 'test',
            HOST: '127.0.0.1',
            PORT: '3000',
            TEST_HTTP_PORT: '3100',
            APP_ORIGIN: url,
            SESSION_SECRET: randomBytes(32).toString('hex'),
            MONGODB_URI: `mongodb://127.0.0.1:27017/easygenerator_auth_test_${randomUUID().replaceAll('-', '')}`,
            CLEAN_TEST_DATABASE: '1',
            TRUST_PROXY_HOPS: '1',
            LOG_LEVEL: 'error',
          },
        },
      );
      let logs = '';
      backend.stdout!.on('data', (data: Buffer) => {
        logs += data.toString();
      });
      backend.stderr!.on('data', (data: Buffer) => {
        logs += data.toString();
      });
      let frontend: ChildProcess | undefined;
      try {
        await Promise.race([
          message(backend),
          once(backend, 'exit').then(() => {
            throw new Error(`Test backend exited: ${logs}`);
          }),
        ]);
        frontend = spawn(
          process.execPath,
          [
            resolve('node_modules/vite/bin/vite.js'),
            'preview',
            '--host',
            '127.0.0.1',
            '--port',
            '4174',
          ],
          {
            cwd: resolve('apps/frontend'),
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, BACKEND_ORIGIN: 'http://127.0.0.1:3100' },
          },
        );
        // Resolve the workspace's Vite CLI through the root install.
        frontend.stdout!.on('data', (data: Buffer) => {
          logs += data.toString();
        });
        frontend.stderr!.on('data', (data: Buffer) => {
          logs += data.toString();
        });
        const deadline = Date.now() + 10_000;
        while (true) {
          if (frontend.exitCode !== null)
            throw new Error(`Test frontend exited: ${logs}`);
          try {
            const res = await fetch(url);
            if (res.ok) break;
          } catch {
            /* Wait for the owned server. */
          }
          if (Date.now() > deadline)
            throw new Error(`Test frontend startup timed out: ${logs}`);
          await new Promise((done) => setTimeout(done, 100));
        }
        await use({
          url,
          message: () => message(backend),
          command: async (command) => {
            const response = message(backend);
            backend.send(command);
            await response;
          },
        });
      } finally {
        if (frontend) await stop(frontend);
        await stop(backend, true);
      }
    },
    { scope: 'worker' },
  ],
  page: async ({ page, runtime, testIp }, use) => {
    void runtime;
    // Only the owned test backend trusts forwarding headers; production Nginx overwrites them.
    await page.context().setExtraHTTPHeaders({ 'X-Forwarded-For': testIp });
    await use(page);
  },
});
export { expect };
