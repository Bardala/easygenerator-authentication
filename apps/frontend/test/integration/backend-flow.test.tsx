import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { fork } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { App } from '../../src/app/App';

const nativeFetch = globalThis.fetch;
let child: ChildProcess;
let baseUrl: string;
let cookie = '';
let logs = '';
beforeAll(async () => {
  const database = `easygenerator_auth_test_${randomUUID().replaceAll('-', '')}`;
  child = fork(
    resolve(process.cwd(), '../backend/test/fixtures/auth-server.mjs'),
    [],
    {
      execArgv: [],
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: {
        ...process.env,
        NODE_OPTIONS: '',
        APP_ENV: 'test',
        APP_ORIGIN: 'http://127.0.0.1:5173',
        PORT: '3000',
        MONGODB_URI: `mongodb://127.0.0.1:27017/${database}`,
        SESSION_SECRET: randomBytes(32).toString('hex'),
        TRUST_PROXY_HOPS: '0',
        LOG_LEVEL: 'error',
        CLEAN_TEST_DATABASE: '1',
      },
    },
  );
  child.stdout!.on('data', (data: Buffer) => {
    logs += data.toString();
  });
  child.stderr!.on('data', (data: Buffer) => {
    logs += data.toString();
  });
  baseUrl = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Backend startup timed out: ${logs}`));
    }, 15000);
    child.once('message', (message) => {
      clearTimeout(timer);
      resolve((message as { ready: string }).ready);
    });
    child.once('exit', () => {
      clearTimeout(timer);
      reject(new Error(`Backend startup failed: ${logs}`));
    });
  });
});
afterAll(async () => {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const stopped = once(child, 'exit');
  const timer = setTimeout(() => child.kill(), 5000);
  child.send('stop');
  try {
    await stopped;
  } finally {
    clearTimeout(timer);
  }
});
function mount(path: string) {
  vi.stubGlobal('fetch', async (input: string, init?: RequestInit) => {
    const res = await nativeFetch(`${baseUrl}${input}`, {
      ...init,
      headers: { ...init?.headers, ...(cookie ? { Cookie: cookie } : {}) },
    });
    const setCookie = res.headers.getSetCookie()[0];
    if (setCookie) cookie = setCookie.split(';')[0]!;
    return res;
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}
it('signup, restore after remount, logout, and sign-in work with the real API and MongoDB', async () => {
  const person = userEvent.setup();
  const email = `${randomUUID()}@example.com`;
  const password = `Abcdef1!${'🙂'.repeat(120)}`;
  let client = mount('/sign-up');
  await person.type(await screen.findByLabelText('Name'), 'Integration User');
  await person.type(screen.getByLabelText('Email'), email);
  await person.type(screen.getByLabelText('Password'), password);
  await person.click(screen.getByRole('button', { name: 'Create account' }));
  await screen.findByRole('heading', { name: 'Welcome to the application.' });
  cleanup();
  client.clear();
  client = mount('/app');
  await screen.findByRole('heading', { name: 'Welcome to the application.' });
  expect(
    screen.getByText(`You are signed in as ${email}.`),
  ).toBeInTheDocument();
  await person.click(screen.getByRole('button', { name: 'Sign out' }));
  await screen.findByRole('heading', { name: 'Sign in' });
  await person.type(screen.getByLabelText('Email'), email);
  await person.type(screen.getByLabelText('Password'), password);
  await person.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByRole('heading', { name: 'Welcome to the application.' });
  cleanup();
  client.clear();
});
