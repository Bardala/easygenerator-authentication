export interface Environment {
  APP_ENV: 'local' | 'test' | 'production';
  PORT: number;
  HOST: '127.0.0.1' | '0.0.0.0';
  APP_ORIGIN: string;
  MONGODB_URI: string;
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';
  SESSION_SECRET: string;
  TRUST_PROXY_HOPS: number;
}

export function validateEnvironment(
  input: Record<string, unknown>,
): Environment {
  const errors: string[] = [];
  const appEnvironment =
    input['APP_ENV'] ??
    (input['NODE_ENV'] === 'production' ? 'production' : 'local');
  const host = input['HOST'] ?? '127.0.0.1';
  if (!['127.0.0.1', '0.0.0.0'].includes(String(host)))
    errors.push('HOST must be 127.0.0.1 or 0.0.0.0.');
  const port = Number(input['PORT'] ?? 3000);
  const origin = String(input['APP_ORIGIN'] ?? '');
  const mongoUri = String(input['MONGODB_URI'] ?? '');
  const logLevel = input['LOG_LEVEL'] ?? 'info';
  const sessionSecret = String(input['SESSION_SECRET'] ?? '');
  const trustProxyHops = Number(input['TRUST_PROXY_HOPS'] ?? 0);
  if (![0, 1].includes(trustProxyHops)) {
    errors.push('TRUST_PROXY_HOPS must be 0 or 1.');
  }

  if (!['local', 'test', 'production'].includes(String(appEnvironment))) {
    errors.push('APP_ENV must be local, test, or production.');
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push('PORT must be an integer between 1 and 65535.');
  }

  try {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
      errors.push(
        'APP_ORIGIN must be an HTTP(S) origin without a path or credentials.',
      );
    }
    if (appEnvironment === 'production' && url.protocol !== 'https:') {
      errors.push('Production APP_ORIGIN requires HTTPS.');
    }
    if (
      appEnvironment !== 'production' &&
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    ) {
      errors.push('Local/test APP_ORIGIN must use a loopback hostname.');
    }
  } catch {
    errors.push('APP_ORIGIN must be a valid HTTP(S) origin.');
  }

  if (!/^mongodb(?:\+srv)?:\/\/\S+$/.test(mongoUri)) {
    errors.push('MONGODB_URI must be a MongoDB connection string.');
  }
  if (!['error', 'warn', 'info', 'debug'].includes(String(logLevel))) {
    errors.push('LOG_LEVEL must be error, warn, info, or debug.');
  }
  if (sessionSecret.length < 32 || sessionSecret.startsWith('replace-')) {
    errors.push(
      'SESSION_SECRET must be a generated secret of at least 32 characters.',
    );
  }

  if (errors.length) {
    throw new Error(`Invalid environment:\n${errors.join('\n')}`);
  }

  return {
    APP_ENV: appEnvironment as Environment['APP_ENV'],
    PORT: port,
    HOST: host as Environment['HOST'],
    APP_ORIGIN: origin,
    MONGODB_URI: mongoUri,
    LOG_LEVEL: logLevel as Environment['LOG_LEVEL'],
    SESSION_SECRET: sessionSecret,
    TRUST_PROXY_HOPS: trustProxyHops,
  };
}
