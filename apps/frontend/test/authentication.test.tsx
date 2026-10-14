import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { App } from '../src/app/App';
import { sessionKey } from '../src/modules/authentication/hooks/useSession';
import { validateField } from '../src/modules/authentication/validation/authentication.validation';

const user = { id: 'user-1', email: 'person@example.com', name: 'Test Person' };
const token = 'initial-token';
function response(body: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function setup(
  path = '/sign-up',
  fetcher?: (url: string, init?: RequestInit) => Promise<Response>,
  initialUser = false,
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  if (initialUser) client.setQueryData(sessionKey, { user, expired: false });
  const fetchMock = vi.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (fetcher) return fetcher(url, init);
      if (url.endsWith('/me'))
        return response(
          { code: 'UNAUTHORIZED', message: 'Authentication is required.' },
          401,
        );
      if (url.endsWith('/csrf')) return response({ csrfToken: token });
      return response(
        { user, csrfToken: 'rotated-token' },
        url.endsWith('/sign-up') ? 201 : 200,
      );
    },
  );
  vi.stubGlobal('fetch', fetchMock);
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { client, fetchMock, person: userEvent.setup() };
}
async function fill(person: ReturnType<typeof userEvent.setup>, signup = true) {
  if (signup)
    await person.type(await screen.findByLabelText('Name'), 'Test Person');
  await person.type(screen.getByLabelText('Email'), 'Person@EXAMPLE.COM');
  await person.type(screen.getByLabelText('Password'), ' Password42! ');
}

describe('validation', () => {
  it('applies signup rules and trimmed name boundaries without sign-in complexity rules', () => {
    expect(validateField('name', '  ab  ', 'sign-up')).toBeDefined();
    expect(validateField('name', '  abc  ', 'sign-up')).toBeUndefined();
    expect(validateField('name', 'x'.repeat(101), 'sign-up')).toBeDefined();
    expect(validateField('password', 'short', 'sign-in')).toBeUndefined();
    for (const value of [
      'Ab1!',
      'abcdefgh!',
      'abcdefgh1 ',
      '1234567!',
      'a'.repeat(129),
    ])
      expect(validateField('password', value, 'sign-up')).toBeDefined();
    expect(validateField('password', 'Letters42!', 'sign-up')).toBeUndefined();
    expect(validateField('email', 'bad', 'sign-in')).toBeDefined();
    expect(
      validateField('password', `Abcdef1!${'🙂'.repeat(120)}`, 'sign-up'),
    ).toBeUndefined();
    expect(
      validateField('password', `Abcdef1!${'🙂'.repeat(121)}`, 'sign-up'),
    ).toBeDefined();
  });
});

it('validates on blur and submission with described errors and first-invalid focus', async () => {
  const { person, fetchMock } = setup();
  const name = await screen.findByLabelText('Name');
  await person.type(name, 'ab');
  await person.tab();
  expect(name).toHaveAttribute('aria-invalid', 'true');
  expect(name).toHaveAccessibleDescription(
    'Enter a name with 3–100 characters.',
  );
  await person.click(screen.getByRole('button', { name: 'Create account' }));
  expect(name).toHaveFocus();
  expect(
    fetchMock.mock.calls.some(([path]) => String(path).endsWith('/sign-up')),
  ).toBe(false);
});

it('isolates password guidance and toggles visibility with an accessible control', async () => {
  const { person } = setup();
  const input = await screen.findByLabelText('Password');
  await person.type(input, 'Password42!');
  expect(
    screen
      .getByLabelText('Password requirements')
      .querySelectorAll('[data-valid="true"]'),
  ).toHaveLength(4);
  await person.click(screen.getByRole('button', { name: 'Show password' }));
  expect(input).toHaveAttribute('type', 'text');
  expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await person.click(screen.getByRole('button', { name: 'Hide password' }));
  expect(input).toHaveAttribute('type', 'password');
});

it('signup sends native form values unchanged, establishes cache and uses the rotated token for logout', async () => {
  const { person, client, fetchMock } = setup('/sign-up', async (url) => {
    if (url.endsWith('/me'))
      return response({ code: 'UNAUTHORIZED', message: 'Required' }, 401);
    if (url.endsWith('/csrf')) return response({ csrfToken: token });
    if (url.endsWith('/sign-out')) return response(undefined, 204);
    return response({ user, csrfToken: 'rotated-token' }, 201);
  });
  await fill(person);
  await person.click(screen.getByRole('button', { name: 'Create account' }));
  expect(
    await screen.findByRole('heading', { name: 'Welcome to the application.' }),
  ).toBeInTheDocument();
  const submitted = fetchMock.mock.calls.find(([url]) =>
    String(url).endsWith('/sign-up'),
  )![1]!;
  expect(JSON.parse(String(submitted.body))).toEqual({
    email: 'person@example.com',
    name: 'Test Person',
    password: ' Password42! ',
  });
  expect(submitted.credentials).toBe('same-origin');
  expect(client.getQueryData(sessionKey)).toEqual({ user, expired: false });
  client.setQueryData(
    ['private-profile'],
    { secret: true },
    { updatedAt: Date.now() },
  );
  client
    .getQueryCache()
    .find({ queryKey: ['private-profile'] })!
    .setOptions({ queryKey: ['private-profile'], meta: { private: true } });
  await person.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(
    await screen.findByRole('heading', { name: 'Sign in' }),
  ).toBeInTheDocument();
  const out = fetchMock.mock.calls.find(([url]) =>
    String(url).endsWith('/sign-out'),
  )![1]!;
  expect(out.headers).toMatchObject({ 'X-CSRF-Token': 'rotated-token' });
  expect(client.getQueryData(['private-profile'])).toBeUndefined();
  expect(client.getQueryData(sessionKey)).toEqual({
    user: null,
    expired: false,
  });
});

it('protects routes until restoration finishes and distinguishes connection failure from an anonymous session', async () => {
  const restore = deferred<Response>();
  let failed = false;
  const { person } = setup('/app', async () => {
    if (!failed) {
      failed = true;
      return restore.promise;
    }
    return response({ user });
  });
  expect(screen.getByRole('status')).toHaveTextContent(
    'Restoring your session',
  );
  expect(
    screen.queryByText('Welcome to the application.'),
  ).not.toBeInTheDocument();
  restore.resolve(response({}, 503));
  expect(
    await screen.findByRole('heading', { name: 'Unable to connect' }),
  ).toBeInTheDocument();
  await person.click(screen.getByRole('button', { name: 'Retry connection' }));
  expect(
    await screen.findByRole('heading', { name: 'Welcome to the application.' }),
  ).toBeInTheDocument();
});

it('redirects expired protected access to sign-in with an expiry explanation', async () => {
  setup('/app', async (url) =>
    url.endsWith('/csrf')
      ? response({ csrfToken: token })
      : response({ code: 'SESSION_EXPIRED', message: 'Expired' }, 401),
  );
  expect(
    await screen.findByRole('heading', { name: 'Sign in' }),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Your session expired. Please sign in again.'),
  ).toHaveAttribute('role', 'status');
});

it('prevents duplicate submissions while showing pending state', async () => {
  const pending = deferred<Response>();
  const { person, fetchMock } = setup('/sign-in', async (url) => {
    if (url.endsWith('/csrf')) return response({ csrfToken: token });
    if (url.endsWith('/me'))
      return response({ code: 'UNAUTHORIZED', message: 'Required' }, 401);
    return pending.promise;
  });
  await screen.findByRole('heading', { name: 'Sign in' });
  await fill(person, false);
  const form = screen.getByRole('form', { name: 'Sign in' });
  fireEvent.submit(form);
  fireEvent.submit(form);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled(),
  );
  expect(
    fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/sign-in')),
  ).toHaveLength(1);
  pending.resolve(response({ user, csrfToken: 'new-token' }));
  await screen.findByRole('heading', { name: 'Welcome to the application.' });
});

it('shows invalid credentials and server field errors without automatic retry', async () => {
  const { person, fetchMock } = setup('/sign-in', async (url) => {
    if (url.endsWith('/csrf')) return response({ csrfToken: token });
    if (url.endsWith('/me'))
      return response({ code: 'UNAUTHORIZED', message: 'Required' }, 401);
    return response(
      { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
      401,
    );
  });
  await screen.findByRole('heading', { name: 'Sign in' });
  await fill(person, false);
  await person.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'The email or password is incorrect.',
  );
  expect(screen.getByLabelText('Password')).toHaveValue(' Password42! ');
  expect(
    fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/sign-in')),
  ).toHaveLength(1);
});

it('keeps failed logout recoverable and only clears private state after confirmation', async () => {
  let attempts = 0;
  const { person, client } = setup(
    '/app',
    async (url) => {
      if (url.endsWith('/csrf')) return response({ csrfToken: token });
      if (url.endsWith('/me')) return response({ user });
      return ++attempts === 1
        ? response(
            { code: 'DEPENDENCY_UNAVAILABLE', message: 'Unavailable' },
            503,
          )
        : response(undefined, 204);
    },
    true,
  );
  await person.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Sign out could not be confirmed',
  );
  expect(client.getQueryData(sessionKey)).toEqual({ user, expired: false });
  await person.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(
    await screen.findByRole('heading', { name: 'Sign in' }),
  ).toBeInTheDocument();
});

it('maps backend validation errors to fields and focuses the first invalid field', async () => {
  const { person } = setup('/sign-up', async (url) => {
    if (url.endsWith('/me'))
      return response({ code: 'UNAUTHORIZED', message: 'Required' }, 401);
    if (url.endsWith('/csrf')) return response({ csrfToken: token });
    return response(
      {
        code: 'VALIDATION_ERROR',
        message: 'Check the submitted fields.',
        fieldErrors: { email: ['Email was rejected.'] },
      },
      400,
    );
  });
  await fill(person);
  await person.click(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByText('Email was rejected.')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByLabelText('Email')).toHaveFocus());
  expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(
    'Email was rejected.',
  );
});

it('recovers from failed token acquisition before allowing a submission', async () => {
  let calls = 0;
  const { person } = setup('/sign-in', async (url) => {
    if (url.endsWith('/me'))
      return response({ code: 'UNAUTHORIZED', message: 'Required' }, 401);
    return ++calls === 1 ? response({}, 503) : response({ csrfToken: token });
  });
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Unable to prepare the secure form',
  );
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  await person.click(
    screen.getByRole('button', { name: 'Retry security token' }),
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled(),
  );
});

it('refreshes a rejected CSRF token and requires an explicit submission retry', async () => {
  let tokens = 0;
  let attempts = 0;
  const { person, fetchMock } = setup('/sign-in', async (url) => {
    if (url.endsWith('/me'))
      return response({ code: 'UNAUTHORIZED', message: 'Required' }, 401);
    if (url.endsWith('/csrf'))
      return response({ csrfToken: `token-${++tokens}` });
    return ++attempts === 1
      ? response({ code: 'CSRF_INVALID', message: 'Invalid token' }, 403)
      : response({ user, csrfToken: 'rotated' });
  });
  await screen.findByRole('heading', { name: 'Sign in' });
  await fill(person, false);
  await person.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Your security token expired',
  );
  expect(attempts).toBe(1);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled(),
  );
  await person.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByRole('heading', { name: 'Welcome to the application.' });
  const requests = fetchMock.mock.calls.filter(([url]) =>
    String(url).endsWith('/sign-in'),
  );
  expect(requests[1]![1]!.headers).toMatchObject({ 'X-CSRF-Token': 'token-2' });
});

it('cancels private requests and prevents late responses from repopulating logout state', async () => {
  const late = deferred<Response>();
  const { person, client, fetchMock } = setup(
    '/app',
    async (url) => {
      if (url.endsWith('/private')) return late.promise;
      if (url.endsWith('/me')) return response({ user });
      if (url.endsWith('/csrf')) return response({ csrfToken: token });
      return response(undefined, 204);
    },
    true,
  );
  const { getJson } = await import('../src/lib/http');
  const outstanding = client
    .fetchQuery({
      queryKey: ['private', 'late'],
      meta: { private: true },
      queryFn: ({ signal }) => getJson('/private', signal),
    })
    .catch(() => undefined);
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).endsWith('/private')),
    ).toBe(true),
  );
  const signal = fetchMock.mock.calls.find(([url]) =>
    String(url).endsWith('/private'),
  )![1]!.signal!;
  await person.click(screen.getByRole('button', { name: 'Sign out' }));
  await screen.findByRole('heading', { name: 'Sign in' });
  expect(signal.aborted).toBe(true);
  late.resolve(response({ secret: 'late private data' }));
  await outstanding;
  expect(client.getQueryData(['private', 'late'])).toBeUndefined();
  expect(client.getQueryData(sessionKey)).toEqual({
    user: null,
    expired: false,
  });
});
