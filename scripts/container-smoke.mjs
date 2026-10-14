import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { chromium, expect } from '@playwright/test';

const project = `easygenerator-smoke-${randomUUID().slice(0, 8)}`;
const directory = await mkdtemp(join(tmpdir(), 'easygenerator-smoke-'));
const port = '18080';
const env = {
  ...process.env,
  SESSION_SECRET: randomBytes(32).toString('hex'),
  MONGO_ROOT_PASSWORD: randomBytes(32).toString('hex'),
  MONGO_APP_PASSWORD: randomBytes(32).toString('hex'),
  PUBLIC_ORIGIN: `https://127.0.0.1:${port}`,
  FRONTEND_PORT: port,
  BIND_ADDRESS: '127.0.0.1',
  TLS_CERT_PATH: join(directory, 'cert.pem'),
  TLS_KEY_PATH: join(directory, 'key.pem'),
};
function command(bin, args, capture = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      env,
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    let output = '';
    if (capture) {
      child.stdout.on('data', (data) => {
        output += data;
      });
      child.stderr.on('data', (data) => {
        output += data;
      });
    }
    child.once('error', () => reject(new Error(`Cannot execute ${bin}.`)));
    child.once('exit', (code) =>
      code === 0
        ? resolve(output)
        : reject(
            new Error(
              `${bin} failed (${code}). Ensure Docker Engine and Compose v2 are available.`,
            ),
          ),
    );
  });
}
const compose = (mode, args, capture = false) =>
  command(
    'docker',
    [
      'compose',
      '--project-name',
      project,
      '-f',
      'compose.yaml',
      '-f',
      `compose.${mode}.yaml`,
      ...args,
    ],
    capture,
  );
function call(origin, path, options = {}, ca) {
  return new Promise((resolve, reject) => {
    const payload =
      options.body === undefined ? undefined : JSON.stringify(options.body);
    const request = (origin.startsWith('https') ? httpsRequest : httpRequest)(
      `${origin}${path}`,
      {
        method: options.method ?? 'GET',
        ...(ca ? { ca } : {}),
        headers: {
          Accept: 'application/json',
          ...(payload
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
              }
            : {}),
          ...(options.cookie ? { Cookie: options.cookie } : {}),
          ...(options.token ? { 'X-CSRF-Token': options.token } : {}),
          ...(options.method === 'POST' ? { Origin: origin } : {}),
        },
        timeout: 5000,
      },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          text += chunk;
        });
        res.on('end', () =>
          resolve({ status: res.statusCode, headers: res.headers, text }),
        );
      },
    );
    request.once('error', reject);
    request.once('timeout', () =>
      request.destroy(new Error('HTTP probe timed out.')),
    );
    request.end(payload);
  });
}
const cookieFrom = (res) => res.headers['set-cookie'][0].split(';')[0];
async function ready(origin, ca) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      if ((await call(origin, '/api/health', {}, ca)).status === 200) return;
    } catch {
      /* Wait for readiness. */
    }
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error('Container readiness timed out.');
}
let started = false;
let mode = 'local';
let browser;
try {
  await command('docker', ['compose', 'version', '--short'], true);
  const configuration = JSON.parse(
    await compose(mode, ['config', '--format', 'json'], true),
  );
  assert.equal(
    configuration.services.backend.ports,
    undefined,
    'API must not publish ports',
  );
  assert.equal(
    configuration.services.mongodb.ports,
    undefined,
    'MongoDB must not publish ports',
  );
  started = true;
  await compose(mode, [
    'up',
    '--build',
    '--detach',
    '--wait',
    '--wait-timeout',
    '120',
  ]);
  for (const service of ['backend', 'frontend', 'mongodb']) {
    const uid = await compose(mode, ['exec', '-T', service, 'id', '-u'], true);
    assert.notEqual(uid.trim(), '0', `${service} must run as non-root`);
  }
  const local = `http://127.0.0.1:${port}`;
  await ready(local);
  const html = await call(local, '/app');
  assert.equal(html.status, 200, 'SPA deep links must serve the application');
  assert.match(html.text, /id="root"/);
  const asset = html.text.match(/src="([^"]+\.js)"/)?.[1];
  assert.ok(asset, 'Built JavaScript asset must exist');
  assert.equal((await call(local, asset)).status, 200);
  const csrf = await call(local, '/api/auth/csrf');
  const email = `${randomUUID()}@example.com`;
  const password = 'Container-password42!';
  const registered = await call(local, '/api/auth/sign-up', {
    method: 'POST',
    cookie: cookieFrom(csrf),
    token: JSON.parse(csrf.text).csrfToken,
    body: { email, name: 'Container User', password },
  });
  assert.equal(registered.status, 201);
  const cookie = cookieFrom(registered);
  assert.match(registered.headers['set-cookie'][0], /HttpOnly/);
  assert.doesNotMatch(registered.headers['set-cookie'][0], /Secure/);
  await compose(mode, ['restart', 'mongodb', 'backend']);
  await ready(local);
  assert.equal(
    (await call(local, '/api/auth/me', { cookie })).status,
    200,
    'Persisted sessions must survive restart',
  );
  const signout = await call(local, '/api/auth/sign-out', {
    method: 'POST',
    cookie,
    token: JSON.parse(registered.text).csrfToken,
    body: {},
  });
  assert.equal(signout.status, 204);
  assert.equal((await call(local, '/api/auth/me', { cookie })).status, 401);

  await command(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-days',
      '1',
      '-keyout',
      env.TLS_KEY_PATH,
      '-out',
      env.TLS_CERT_PATH,
      '-subj',
      '/CN=localhost',
      '-addext',
      'subjectAltName=DNS:localhost,IP:127.0.0.1',
    ],
    true,
  );
  // The temporary host directory is private; the mounted key must be readable by nginx.
  await chmod(env.TLS_KEY_PATH, 0o644);
  mode = 'https';
  await compose(mode, ['up', '--detach', '--wait', '--wait-timeout', '120']);
  const ca = await readFile(env.TLS_CERT_PATH);
  await ready(env.PUBLIC_ORIGIN, ca);
  const productionCsrf = await call(
    env.PUBLIC_ORIGIN,
    '/api/auth/csrf',
    {},
    ca,
  );
  assert.match(productionCsrf.headers['set-cookie'][0], /^__Host-eg.sid=/);
  assert.match(productionCsrf.headers['set-cookie'][0], /Secure/);
  assert.doesNotMatch(productionCsrf.headers['set-cookie'][0], /Domain=/);
  assert.equal(
    (await call(env.PUBLIC_ORIGIN, '/api/docs-json', {}, ca)).status,
    404,
  );
  browser = await chromium.launch();
  // Only this isolated self-signed test context bypasses browser certificate trust.
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await page.goto(`${env.PUBLIC_ORIGIN}/sign-in`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Welcome to the application.' }),
  ).toBeVisible();
  assert.ok(
    (await context.cookies()).some(
      (value) =>
        value.name === '__Host-eg.sid' &&
        value.secure &&
        value.httpOnly &&
        value.sameSite === 'Lax',
    ),
  );
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Welcome to the application.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Sign in', exact: true }),
  ).toBeVisible();
  console.log(
    'Container smoke checks passed: private networking, non-root users, SPA/assets, persistence, HTTP sessions, HTTPS browser cookies and logout.',
  );
} finally {
  if (browser) await browser.close();
  // Only this randomly named smoke project and its disposable volume are removed.
  if (started)
    await compose(mode, ['down', '--volumes', '--remove-orphans']).catch(() =>
      console.error(
        'Smoke cleanup failed; remove only the reported temporary project:',
        project,
      ),
    );
  await rm(directory, { recursive: true, force: true });
}
