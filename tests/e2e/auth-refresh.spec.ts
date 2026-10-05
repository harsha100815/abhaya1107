import { test, expect } from '@playwright/test';

test('sign-in resumes dashboard updates and an expired session stops them', async ({ page }) => {
  let authenticated = false;
  let dashboardRequests = 0;
  const user = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'QA Traveller',
    email: 'qa@example.test',
    phone: null,
    emailVerifiedAt: null,
    theme: 'light',
    pushEnabled: false,
    securityEmails: true,
    hasAvatar: false,
  };
  const success = (data: unknown) => ({ success: true, error: null, data });
  const unauthorized = {
    status: 401,
    json: { error: { code: 'SESSION_EXPIRED', message: 'Sign in.' } },
  };
  await page.route('**/api/dashboard', async (route) => {
    dashboardRequests++;
    await route.fulfill(
      authenticated
        ? { json: success({ user, contacts: [], emergencies: [], journeys: [], incidents: [] }) }
        : unauthorized,
    );
  });
  await page.route('**/api/auth/refresh', (route) => route.fulfill(unauthorized));
  await page.route('**/api/auth/login', async (route) => {
    authenticated = true;
    await route.fulfill({ json: success({ user }) });
  });
  await page.route('**/api/config', (route) =>
    route.fulfill({
      json: success({
        testOnly: true,
        liveAlertsConfigured: false,
        emailVerificationConfigured: false,
        emergencyNumber: null,
      }),
    }),
  );
  await page.clock.install();
  await page.goto('/');
  const signIn = async () => {
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByLabel('Email address', { exact: true }).fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill('valid test password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Hello, QA/ })).toBeVisible();
  };
  await signIn();
  const afterLogin = dashboardRequests;
  await page.clock.runFor(11000);
  await expect.poll(() => dashboardRequests).toBeGreaterThan(afterLogin);
  authenticated = false;
  await page.clock.runFor(11000);
  await expect(page.getByLabel('Your name', { exact: true })).toBeVisible();
  await page.getByLabel('Your name', { exact: true }).fill('Still typing');
  const afterExpiry = dashboardRequests;
  await page.clock.runFor(21000);
  await expect(page.getByLabel('Your name', { exact: true })).toHaveValue('Still typing');
  expect(dashboardRequests).toBe(afterExpiry);
  await signIn();
  const afterSecondLogin = dashboardRequests;
  await page.clock.runFor(11000);
  await expect.poll(() => dashboardRequests).toBeGreaterThan(afterSecondLogin);
});

for (const mode of ['register', 'login', 'forgot'] as const) {
  test(`${mode} keeps input and focus through polling, tab focus and reconnect`, async ({
    page,
  }) => {
    let dashboardRequests = 0;
    let refreshRequests = 0;
    await page.route('**/api/dashboard', async (route) => {
      dashboardRequests++;
      await route.fulfill({
        status: 401,
        json: { error: { code: 'UNAUTHORIZED', message: 'Sign in.' } },
      });
    });
    await page.route('**/api/auth/refresh', async (route) => {
      refreshRequests++;
      await route.fulfill({
        status: 401,
        json: { error: { code: 'SESSION_EXPIRED', message: 'Sign in.' } },
      });
    });
    await page.route('**/api/config', (route) =>
      route.fulfill({
        json: {
          success: true,
          error: null,
          data: {
            testOnly: true,
            liveAlertsConfigured: false,
            emailVerificationConfigured: false,
            emergencyNumber: null,
          },
        },
      }),
    );
    await page.clock.install();
    await page.goto('/');
    await expect(page.getByLabel('Your name', { exact: true })).toBeVisible();
    if (mode !== 'register')
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    if (mode === 'forgot')
      await page.getByRole('button', { name: 'Forgot your password?' }).click();
    if (mode === 'register')
      await page.getByLabel('Your name', { exact: true }).fill('Unfinished name');
    if (mode !== 'forgot')
      await page.getByLabel('Password', { exact: true }).fill('unfinished password');
    const email = page.getByLabel('Email address', { exact: true });
    await email.fill('unfinished@example.test');
    await page.clock.runFor(21000);
    await page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('offline'));
      window.dispatchEvent(new Event('online'));
    });
    await page.clock.runFor(1000);
    await expect(email).toHaveValue('unfinished@example.test');
    await expect(email).toBeFocused();
    if (mode === 'register')
      await expect(page.getByLabel('Your name', { exact: true })).toHaveValue('Unfinished name');
    if (mode !== 'forgot')
      await expect(page.getByLabel('Password', { exact: true })).toHaveValue('unfinished password');
    expect(dashboardRequests).toBe(1);
    expect(refreshRequests).toBe(1);
  });
}
