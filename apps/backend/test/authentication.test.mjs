import { beforeAll, afterAll, test, expect } from '@jest/globals';
import { fork } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import mongoose from 'mongoose';
import request from 'supertest';

const databaseName = `easygenerator_auth_test_${randomUUID().replaceAll('-', '')}`;
const mongoUri = `mongodb://127.0.0.1:27017/${databaseName}`;
const secret = randomBytes(32).toString('hex');
const password = 'Sensitive-password42!';
let client;
let server;
let ip = 1;
let connected = false;
const servers = [];

async function start(production = false) {
  const child = fork(
    new URL('./fixtures/auth-server.mjs', import.meta.url),
    [],
    {
      execArgv: [],
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: {
        ...process.env,
        NODE_OPTIONS: '',
        APP_ENV: production ? 'production' : 'test',
        APP_ORIGIN: production
          ? 'https://example.com'
          : 'http://127.0.0.1:5173',
        MONGODB_URI: mongoUri,
        SESSION_SECRET: secret,
        TRUST_PROXY_HOPS: '1',
        LOG_LEVEL: 'info',
      },
    },
  );
  const instance = { child, logs: '', url: undefined };
  servers.push(instance);
  child.stdout.on('data', (data) => {
    instance.logs += data;
  });
  child.stderr.on('data', (data) => {
    instance.logs += data;
  });
  instance.url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`API startup timeout: ${instance.logs}`));
    }, 15000);
    child.once('message', (message) => {
      clearTimeout(timer);
      resolve(message.ready);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`API exited (${code}): ${instance.logs}`));
    });
  });
  return instance;
}
async function stop(instance) {
  if (instance.child.exitCode !== null || instance.child.signalCode !== null)
    return;
  const exited = once(instance.child, 'exit');
  const timer = setTimeout(() => instance.child.kill(), 5000);
  instance.child.send('stop');
  try {
    await exited;
  } finally {
    clearTimeout(timer);
  }
}
function agent(instance = server) {
  const http = request.agent(instance.url);
  const address = `198.51.100.${ip++}`;
  const call = (method, path) =>
    http[method](path).set('X-Forwarded-For', address);
  return {
    get: (path) => call('get', path),
    post: (path) => call('post', path),
  };
}
async function csrf(http) {
  const res = await http.get('/api/auth/csrf').expect(200);
  return {
    token: res.body.csrfToken,
    cookie: res.headers['set-cookie'][0].split(';')[0],
  };
}
async function signup(
  http,
  email = `${randomUUID()}@example.com`,
  suppliedPassword = password,
) {
  const { token, cookie } = await csrf(http);
  const res = await http
    .post('/api/auth/sign-up')
    .set('X-CSRF-Token', token)
    .send({ email, name: 'Test User', password: suppliedPassword })
    .expect(201);
  return {
    res,
    oldToken: token,
    oldCookie: cookie,
    email: email.trim().toLowerCase(),
  };
}
async function expire(http, mode) {
  const { res } = await signup(http);
  const stored = await client
    .db()
    .collection('sessions')
    .findOne({ 'session.userId': res.body.user.id });
  const expiredAt =
    Date.now() -
    (mode === 'createdAt' ? 24 * 60 * 60 * 1000 : 30 * 60 * 1000) -
    1000;
  await client
    .db()
    .collection('sessions')
    .updateOne(
      { _id: stored._id },
      { $set: { [`session.${mode}`]: expiredAt } },
    );
  const expired = await http.get('/api/auth/me').expect(401);
  expect(expired.body.code).toBe('SESSION_EXPIRED');
  expect(
    await client.db().collection('sessions').findOne({ _id: stored._id }),
  ).toBeNull();
}

beforeAll(async () => {
  client = new mongoose.mongo.MongoClient(mongoUri, {
    serverSelectionTimeoutMS: 2000,
  });
  await client.connect();
  connected = true;
  server = await start();
}, 25000);
afterAll(async () => {
  await Promise.all(servers.map(stop));
  if (client) {
    if (!databaseName.startsWith('easygenerator_auth_test_'))
      throw new Error('Unsafe cleanup database');
    if (connected) await client.db().dropDatabase();
    await client.close();
  }
}, 15000);

test('signup normalizes fields, rotates session and token, persists only an Argon2 hash, and protects public responses', async () => {
  const http = agent();
  const { res, oldCookie, oldToken, email } = await signup(
    http,
    ' Normalized@EXAMPLE.COM ',
  );
  expect(res.body.user).toEqual({
    id: expect.any(String),
    email,
    name: 'Test User',
  });
  expect(Object.keys(res.body).sort()).toEqual(['csrfToken', 'user']);
  expect(res.body.csrfToken).not.toBe(oldToken);
  const cookie = res.headers['set-cookie'][0];
  expect(cookie.split(';')[0]).not.toBe(oldCookie);
  expect(cookie).toMatch(/HttpOnly/);
  expect(cookie).toMatch(/SameSite=Lax/);
  expect(cookie).not.toMatch(/Domain=|Secure/);
  expect(res.headers['cache-control']).toBe('no-store');
  expect(res.headers['x-powered-by']).toBeUndefined();
  expect(res.headers['x-request-id']).toMatch(/^[\da-f-]{36}$/);
  const saved = await client.db().collection('users').findOne({ email });
  const [, algorithm, version, parameters] = saved.passwordHash.split('$');
  expect(algorithm).toBe('argon2id');
  expect(version).toBe('v=19');
  expect(parameters.split(',').sort()).toEqual(['m=19456', 'p=1', 't=2']);
  expect(saved.password).toBeUndefined();
  expect(saved.createdAt).toBeInstanceOf(Date);
  await http.get('/api/auth/me').expect(200, { user: res.body.user });
  await request(server.url)
    .get('/api/auth/me')
    .set('Cookie', oldCookie)
    .expect(401);
  await http
    .post('/api/auth/sign-out')
    .set('X-CSRF-Token', oldToken)
    .send({})
    .expect(403);
  const out = await http
    .post('/api/auth/sign-out')
    .set('X-CSRF-Token', res.body.csrfToken)
    .send({})
    .expect(204);
  expect(out.headers['set-cookie'][0]).toMatch(/Expires=Thu, 01 Jan 1970/);
  await http.get('/api/auth/me').expect(401);
  const loginToken = (await csrf(http)).token;
  await http
    .post('/api/auth/sign-in')
    .set('X-CSRF-Token', loginToken)
    .send({ email: email.toUpperCase(), password })
    .expect(200);
});

test('rejects missing, incorrect, cross-session CSRF tokens and disallowed origins', async () => {
  const http = agent();
  const token = (await csrf(http)).token;
  const other = (await csrf(agent())).token;
  for (const value of ['', 'incorrect', other]) {
    const res = await http
      .post('/api/auth/sign-in')
      .set('X-CSRF-Token', value)
      .send({})
      .expect(403);
    expect(res.body.code).toBe('CSRF_INVALID');
  }
  await http
    .post('/api/auth/sign-in')
    .set('X-CSRF-Token', token)
    .set('Origin', 'https://evil.example')
    .send({})
    .expect(403);
  await http
    .post('/api/auth/sign-in')
    .set('X-CSRF-Token', token)
    .type('text')
    .send('hello')
    .expect(415);
});

test('validates signup boundaries and rejects unexpected properties with field errors', async () => {
  const cases = [
    { email: 'bad' },
    { email: `${'a'.repeat(243)}@example.com` },
    { name: '  ab  ' },
    { name: 'a'.repeat(101) },
    { name: 3 },
    { password: 'Ab1!' },
    { password: 'a'.repeat(129) },
    { password: '1234567!' },
    { password: 'abcdefgh!' },
    { password: 'abcdefgh1 ' },
    { role: 'admin' },
    { email: { $ne: null } },
  ];
  for (const invalid of cases) {
    const http = agent();
    const token = (await csrf(http)).token;
    const res = await http
      .post('/api/auth/sign-up')
      .set('X-CSRF-Token', token)
      .send({
        email: `${randomUUID()}@example.com`,
        name: 'Test User',
        password,
        ...invalid,
      })
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(res.body.fieldErrors)).toContain(
      Object.keys(invalid)[0],
    );
    expect(JSON.stringify(res.body)).not.toContain(password);
  }
});

test('preserves passwords exactly and accepts trimmed minimum names and maximum password length', async () => {
  const http = agent();
  const token = (await csrf(http)).token;
  const email = `${randomUUID()}@example.com`;
  const exact = ` A1!${'x'.repeat(123)} `;
  const res = await http
    .post('/api/auth/sign-up')
    .set('X-CSRF-Token', token)
    .send({ email, name: '  abc  ', password: exact })
    .expect(201);
  expect(res.body.user.name).toBe('abc');
  await http
    .post('/api/auth/sign-out')
    .set('X-CSRF-Token', res.body.csrfToken)
    .send({})
    .expect(204);
  const nextToken = (await csrf(http)).token;
  await http
    .post('/api/auth/sign-in')
    .set('X-CSRF-Token', nextToken)
    .send({ email, password: exact.trim() })
    .expect(401);
  await http
    .post('/api/auth/sign-in')
    .set('X-CSRF-Token', nextToken)
    .send({ email, password: exact })
    .expect(200);
});

test('accepts maximum email and name lengths and the minimum password length', async () => {
  const http = agent();
  const token = (await csrf(http)).token;
  const email = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(57)}.com`;
  expect(email).toHaveLength(254);
  const res = await http
    .post('/api/auth/sign-up')
    .set('X-CSRF-Token', token)
    .send({ email, name: 'a'.repeat(100), password: 'Abcdef1!' })
    .expect(201);
  expect(res.body.user.email).toBe(email);
  expect(res.body.user.name).toHaveLength(100);
});

test('signout accepts an empty body, rejects properties, and removes the persisted session', async () => {
  const http = agent();
  const { res } = await signup(http);
  await http
    .post('/api/auth/sign-out')
    .set('X-CSRF-Token', res.body.csrfToken)
    .send({ unexpected: true })
    .expect(400);
  await http
    .post('/api/auth/sign-out')
    .set('X-CSRF-Token', res.body.csrfToken)
    .expect(204);
  expect(
    await client
      .db()
      .collection('sessions')
      .countDocuments({ 'session.userId': res.body.user.id }),
  ).toBe(0);
  await http.get('/api/auth/me').expect(401);
});

test('invalid sign-in data returns field errors and never includes credentials', async () => {
  for (const invalid of [
    { email: 'invalid' },
    { password: '' },
    { password: 42 },
    { password: 'x'.repeat(129) },
    { extra: true },
  ]) {
    const http = agent();
    const token = (await csrf(http)).token;
    const res = await http
      .post('/api/auth/sign-in')
      .set('X-CSRF-Token', token)
      .send({ email: 'user@example.com', password, ...invalid })
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(res.body.fieldErrors)).toContain(
      Object.keys(invalid)[0],
    );
    expect(JSON.stringify(res.body)).not.toContain(password);
  }
});

test('returns the same error for incorrect password and unknown account, without signup complexity checks at signin', async () => {
  const http = agent();
  const { res, email } = await signup(http);
  const errors = [];
  for (const credentials of [
    { email, password: 'short' },
    { email: 'unknown@example.com', password: 'short' },
  ]) {
    errors.push(
      (
        await http
          .post('/api/auth/sign-in')
          .set('X-CSRF-Token', res.body.csrfToken)
          .send(credentials)
          .expect(401)
      ).body,
    );
  }
  expect(errors[0]).toEqual(errors[1]);
  expect(errors[0].code).toBe('INVALID_CREDENTIALS');
});

test('database uniqueness handles normalized and simultaneous duplicate signup', async () => {
  const email = `${randomUUID()}@example.com`;
  const clients = [agent(), agent()];
  const tokens = await Promise.all(clients.map(csrf));
  const results = await Promise.all(
    clients.map((http, index) =>
      http
        .post('/api/auth/sign-up')
        .set('X-CSRF-Token', tokens[index].token)
        .send({
          email: index ? email.toUpperCase() : email,
          name: 'Test User',
          password,
        }),
    ),
  );
  expect(results.map((res) => res.status).sort()).toEqual([201, 409]);
  expect(await client.db().collection('users').countDocuments({ email })).toBe(
    1,
  );
  const indexes = await client.db().collection('users').indexes();
  expect(indexes.some((index) => index.key.email === 1 && index.unique)).toBe(
    true,
  );
});

test('enforces idle and absolute expiry independently of MongoDB TTL cleanup', async () => {
  await expire(agent(), 'lastSeenAt');
  await expire(agent(), 'createdAt');
});

test('MongoDB expiry cannot be bypassed by manually replaying the cookie', async () => {
  const http = agent();
  const { res } = await signup(http);
  const cookie = res.headers['set-cookie'][0].split(';')[0];
  await client
    .db()
    .collection('sessions')
    .updateOne(
      { 'session.userId': res.body.user.id },
      { $set: { expires: new Date(Date.now() - 1000) } },
    );
  await request(server.url)
    .get('/api/auth/me')
    .set('Cookie', cookie)
    .expect(401);
});

test('activity renews idle time while cookie lifetime remains bounded by absolute expiry', async () => {
  const http = agent();
  const { res } = await signup(http);
  const now = Date.now();
  await client
    .db()
    .collection('sessions')
    .updateOne(
      { 'session.userId': res.body.user.id },
      {
        $set: {
          'session.createdAt': now - 24 * 60 * 60 * 1000 + 5 * 60 * 1000,
          'session.lastSeenAt': now - 10 * 60 * 1000,
        },
      },
    );
  const refreshed = await http.get('/api/auth/me').expect(200);
  const stored = await client
    .db()
    .collection('sessions')
    .findOne({ 'session.userId': res.body.user.id });
  expect(stored.session.lastSeenAt).toBeGreaterThanOrEqual(now);
  expect(stored.expires.getTime()).toBeLessThanOrEqual(
    now + 5 * 60 * 1000 + 1000,
  );
  expect(refreshed.headers['set-cookie'][0]).toMatch(/Expires=/);
});

test('sessions survive API restart and are invalidated when the account is deleted', async () => {
  const http = agent();
  const { res } = await signup(http);
  const cookie = res.headers['set-cookie'][0].split(';')[0];
  await stop(server);
  server = await start();
  await request(server.url)
    .get('/api/auth/me')
    .set('Cookie', cookie)
    .expect(200);
  await client
    .db()
    .collection('users')
    .deleteOne({ _id: new mongoose.Types.ObjectId(res.body.user.id) });
  await request(server.url)
    .get('/api/auth/me')
    .set('Cookie', cookie)
    .expect(401);
});

test('a protected request finishing after logout does not recreate the session', async () => {
  const http = agent();
  const { res } = await signup(http);
  const cookie = res.headers['set-cookie'][0].split(';')[0];
  const prepared = once(server.child, 'message');
  server.child.send('pause-user-lookup');
  await prepared;
  const waiting = once(server.child, 'message');
  const late = request(server.url)
    .get('/api/auth/me')
    .set('Cookie', cookie)
    .then((result) => result);
  await waiting;
  await http
    .post('/api/auth/sign-out')
    .set('X-CSRF-Token', res.body.csrfToken)
    .send({})
    .expect(204);
  server.child.send('resume-user-lookup');
  await late;
  expect(
    await client
      .db()
      .collection('sessions')
      .countDocuments({ 'session.userId': res.body.user.id }),
  ).toBe(0);
  await request(server.url)
    .get('/api/auth/me')
    .set('Cookie', cookie)
    .expect(401);
});

test('limits signin and signup together to ten attempts per IP per minute', async () => {
  const http = agent();
  const token = (await csrf(http)).token;
  for (let attempt = 0; attempt < 10; attempt++) {
    await http
      .post(attempt % 2 ? '/api/auth/sign-up' : '/api/auth/sign-in')
      .set('X-CSRF-Token', token)
      .send({})
      .expect(400);
  }
  const res = await http
    .post('/api/auth/sign-in')
    .set('X-CSRF-Token', token)
    .send({})
    .expect(429);
  expect(res.body.code).toBe('RATE_LIMITED');
});

test('general rate limit aggregates requests across endpoints', async () => {
  const http = agent();
  for (let count = 0; count < 100; count++)
    await http.get('/api/health').expect(200);
  await http.get('/api/auth/me').expect(429);
});

test('sanitizes parser errors and enforces the 16 KiB body limit', async () => {
  const http = agent();
  const token = (await csrf(http)).token;
  const malformed = await http
    .post('/api/auth/sign-in')
    .set('Content-Type', 'application/json')
    .send('{"password":"SECRET"')
    .expect(400);
  expect(JSON.stringify(malformed.body)).not.toContain('SECRET');
  await http
    .post('/api/auth/sign-in')
    .set('X-CSRF-Token', token)
    .send({ password: 'x'.repeat(17000) })
    .expect(413);
});

test('documents local API and requires host-only secure production cookies', async () => {
  await request(server.url).get('/api/docs-json').expect(200);
  const production = await start(true);
  const tokenRes = await request(production.url)
    .get('/api/auth/csrf')
    .set('X-Forwarded-Proto', 'https')
    .expect(200);
  const cookie = tokenRes.headers['set-cookie'][0];
  expect(cookie).toMatch(/^__Host-eg.sid=/);
  expect(cookie).toMatch(/Secure/);
  expect(cookie).toMatch(/HttpOnly/);
  expect(cookie).toMatch(/SameSite=Lax/);
  expect(cookie).not.toMatch(/Domain=/);
  expect(cookie).toMatch(/Path=\//);
  expect(tokenRes.headers['strict-transport-security']).toBeDefined();
  expect(tokenRes.headers['content-security-policy']).toBeDefined();
  const registered = await request(production.url)
    .post('/api/auth/sign-up')
    .set('X-Forwarded-Proto', 'https')
    .set('Cookie', cookie.split(';')[0])
    .set('Origin', 'https://example.com')
    .set('X-CSRF-Token', tokenRes.body.csrfToken)
    .send({
      email: `${randomUUID()}@example.com`,
      name: 'Production User',
      password,
    })
    .expect(201);
  const authCookie = registered.headers['set-cookie'][0].split(';')[0];
  await request(production.url)
    .get('/api/auth/me')
    .set('X-Forwarded-Proto', 'https')
    .set('Cookie', authCookie)
    .expect(200);
  const out = await request(production.url)
    .post('/api/auth/sign-out')
    .set('X-Forwarded-Proto', 'https')
    .set('Cookie', authCookie)
    .set('X-CSRF-Token', registered.body.csrfToken)
    .expect(204);
  expect(out.headers['set-cookie'][0]).toMatch(/^__Host-eg.sid=;/);
  expect(out.headers['set-cookie'][0]).toMatch(/Secure/);
  const insecure = await request(production.url)
    .get('/api/auth/csrf')
    .expect(200);
  expect(insecure.headers['set-cookie']).toBeUndefined();
  await request(production.url).get('/api/docs-json').expect(404);
  await stop(production);
});

test('dependency failures return sanitized 503 responses and logs exclude secrets', async () => {
  const disconnected = once(server.child, 'message');
  server.child.send('disconnect');
  await disconnected;
  const res = await request(server.url).get('/api/auth/csrf').expect(503);
  expect(res.body.code).toBe('DEPENDENCY_UNAVAILABLE');
  await request(server.url).get('/api/health').expect(503);
  for (const instance of servers) {
    expect(instance.logs).not.toContain(password);
    expect(instance.logs).not.toContain(secret);
    expect(instance.logs).not.toContain(mongoUri);
    expect(instance.logs).not.toContain('Normalized@');
    expect(instance.logs).not.toContain('csrfToken');
    expect(instance.logs).not.toContain('eg.sid=');
  }
});
