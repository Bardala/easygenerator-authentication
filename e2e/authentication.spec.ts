import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
const password = 'Browser-password42!';
async function signup(
  page: Page,
  url: string,
  beforeSubmit?: () => Promise<void>,
) {
  const email = `${randomUUID()}@example.com`;
  await page.goto(`${url}/sign-up`);
  await expect(
    page.getByRole('button', { name: 'Create account', exact: true }),
  ).toBeEnabled();
  if (beforeSubmit) await beforeSubmit();
  await page.getByLabel('Name', { exact: true }).fill('Browser User');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Welcome to the application.' }),
  ).toBeVisible();
  return email;
}
test('signup, refresh, logout and sign-in use actual browser cookies', async ({
  page,
  runtime,
}, info) => {
  const email = await signup(page, runtime.url, async () => {
    await page.screenshot({
      path: info.outputPath('signup-desktop.png'),
      fullPage: true,
    });
  });
  const cookies = await page.context().cookies();
  expect(cookies.find((cookie) => cookie.name === 'eg.sid')).toMatchObject({
    httpOnly: true,
    sameSite: 'Lax',
    secure: false,
  });
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Welcome to the application.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Sign in', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Welcome to the application.' }),
  ).toBeVisible();
});
test('direct protected navigation and reload remain anonymous', async ({
  page,
  runtime,
}) => {
  await page.goto(`${runtime.url}/app`);
  await expect(page).toHaveURL(`${runtime.url}/sign-in`);
  await expect(
    page.getByRole('heading', { name: 'Sign in', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Sign in', exact: true }),
  ).toBeVisible();
});
test('server-side expiry explains why sign-in is required', async ({
  page,
  runtime,
}) => {
  await signup(page, runtime.url);
  const res = await page.request.get(`${runtime.url}/api/auth/me`);
  const body = (await res.json()) as { user: { id: string } };
  await runtime.command({ command: 'expire', userId: body.user.id });
  await page.reload();
  await expect(
    page.getByText('Your session expired. Please sign in again.'),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Sign in', exact: true }),
  ).toBeVisible();
});
test('restoration and failed logout recover without silently discarding authentication', async ({
  page,
  runtime,
}) => {
  await signup(page, runtime.url);
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'Unavailable',
      }),
    });
  });
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Unable to connect' }),
  ).toBeVisible();
  await page.unroute('**/api/auth/me');
  await page.getByRole('button', { name: 'Retry connection' }).click();
  await expect(
    page.getByRole('heading', { name: 'Welcome to the application.' }),
  ).toBeVisible();
  await page.route('**/api/auth/sign-out', async (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'Unavailable',
      }),
    }),
  );
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Sign out could not be confirmed',
  );
  await expect(
    page.getByRole('heading', { name: 'Welcome to the application.' }),
  ).toBeVisible();
  await page.unroute('**/api/auth/sign-out');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Sign in', exact: true }),
  ).toBeVisible();
});
test('a late session restoration response cannot restore logged-out state', async ({
  page,
  runtime,
}) => {
  await signup(page, runtime.url);
  await page.clock.install();
  await page.clock.fastForward(61_000);
  await runtime.command('pause-user-lookup');
  const waiting = runtime.message();
  await page.evaluate(() =>
    window.dispatchEvent(new Event('visibilitychange')),
  );
  await waiting;
  try {
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Sign in', exact: true }),
    ).toBeVisible();
  } finally {
    await runtime.command('resume-user-lookup');
  }
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Sign in', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Welcome to the application.' }),
  ).toHaveCount(0);
});
test('mobile form fits the viewport and supports keyboard validation', async ({
  page,
  runtime,
}, info) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${runtime.url}/sign-up`);
  await expect(
    page.getByRole('button', { name: 'Create account', exact: true }),
  ).toBeEnabled();
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(page.getByLabel('Name', { exact: true })).toBeFocused();
  await expect(page.getByLabel('Name', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath('signup-mobile.png'),
    fullPage: true,
  });
});
