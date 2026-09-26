import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
test('typing in registration and login survives the dashboard polling interval and focus changes', async ({
  page,
}) => {
  await page.goto('/');
  const name = page.getByLabel('Your name', { exact: true });
  const email = page.getByLabel('Email address', { exact: true });
  const password = page.getByLabel('Password', { exact: true });
  await name.fill('Unsubmitted draft');
  await email.fill('draft@example.test');
  await password.fill('unsubmitted draft password');
  // Deliberately cross the 10-second dashboard interval while the form is unfinished.
  await page.waitForTimeout(12000);
  await expect(name).toHaveValue('Unsubmitted draft');
  await expect(email).toHaveValue('draft@example.test');
  await expect(password).toHaveValue('unsubmitted draft password');
  await expect(password).toBeFocused();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await email.fill('login-draft@example.test');
  await password.fill('another draft password');
  await page.evaluate(() => {
    window.dispatchEvent(new Event('blur'));
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
  });
  await page.waitForTimeout(12000);
  await expect(page.getByRole('heading', { name: 'Good to have you back.' })).toBeVisible();
  await expect(email).toHaveValue('login-draft@example.test');
  await expect(password).toHaveValue('another draft password');
  await expect(password).toBeFocused();
});

async function register(page: Page) {
  const email = `browser-${randomUUID()}@example.test`;
  await page.goto('/');
  await page.getByLabel('Your name', { exact: true }).fill('QA Traveller');
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('browser test password unique');
  await page.getByRole('button', { name: 'Create my account', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Hello, QA/ })).toBeVisible();
  return email;
}
async function nav(page: Page, name: string) {
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name, exact: true })
    .click();
}
test('register, login, contact, GPS, TEST SOS, location update and resolution', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 17.4001, longitude: 78.4001, accuracy: 10 });
  await page.goto('/');
  await expect(page.getByLabel('Your name', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/welcome.png', fullPage: true });
  const email = await register(page);
  await nav(page, 'Settings');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('browser test password unique');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Hello, QA/ })).toBeVisible();
  await nav(page, 'Your circle');
  await page.getByRole('button', { name: 'Add contact', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Trusted friend');
  await page.getByLabel('Phone (international format)', { exact: true }).fill('+919999999992');
  await page.getByLabel('This person agreed to receive my safety alerts').check();
  await page.getByRole('button', { name: 'Save contact' }).click();
  await expect(page.getByRole('heading', { name: 'Trusted friend', exact: true })).toBeVisible();
  await nav(page, 'Overview');
  await page.getByRole('button', { name: 'Refresh my location' }).click();
  await expect(page.getByText('GPS obtained', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/dashboard.png', fullPage: true });
  await page.getByLabel('Share my live location with alerted contacts for this SOS').check();
  await page.getByRole('button', { name: 'Start countdown without holding' }).click();
  await page.getByRole('button', { name: 'Cancel countdown' }).click();
  await expect(page.getByText('Your SOS is recorded.')).toHaveCount(0);
  await page.getByRole('button', { name: 'Start countdown without holding' }).click();
  await expect(page.getByRole('heading', { name: 'Your SOS is recorded.' })).toBeVisible();
  await expect(page.getByText('Simulated · no message sent')).toBeVisible();
  await context.setGeolocation({ latitude: 17.4009, longitude: 78.401, accuracy: 8 });
  await expect
    .poll(
      async () => {
        const dashboard = await page.request.get('/api/dashboard');
        const state = await dashboard.json();
        return state.data.emergencies.find((e: { status: string }) => e.status === 'ACTIVE')
          .locations[0]?.latitude;
      },
      { timeout: 25000, intervals: [1000] },
    )
    .toBe(17.4009);
  await page.getByRole('button', { name: 'I’m safe · resolve SOS' }).click();
  await expect(page.getByRole('button', { name: 'Hold for SOS' })).toBeVisible();
  await nav(page, 'Settings');
  await page.getByLabel('Appearance').selectOption('dark');
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await nav(page, 'Overview');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: 'docs/screenshots/dashboard-dark.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'docs/screenshots/mobile-web.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
test('denied GPS leaves SOS available without fake coordinates', async ({ page, context }) => {
  await context.clearPermissions();
  await context.setGeolocation(null);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: (_success: unknown, error: (e: { code: number }) => void) =>
          error({ code: 1 }),
        watchPosition: () => 1,
        clearWatch: () => {},
      },
    });
  });
  await register(page);
  await page.getByRole('button', { name: 'Refresh my location' }).click();
  await expect(page.getByText(/Location unavailable. Check GPS/)).toBeVisible();
  await page.getByRole('button', { name: 'Start countdown without holding' }).click();
  await expect(page.getByRole('heading', { name: 'Your SOS is recorded.' })).toBeVisible();
  const r = await page.request.get('/api/dashboard');
  const state = await r.json();
  expect(state.data.emergencies[0].locations).toHaveLength(0);
});
test('offline SOS remains explicitly unconfirmed and recovers with the same request', async ({
  page,
  context,
}) => {
  await register(page);
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Start countdown without holding' }).click();
  await expect(page.getByText(/Your SOS is unconfirmed/)).toBeVisible();
  await expect(page.getByText('Your SOS is recorded.')).toHaveCount(0);
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Retry same SOS' }).click();
  await expect(page.getByRole('heading', { name: 'Your SOS is recorded.' })).toBeVisible();
  const r = await page.request.get('/api/dashboard');
  expect((await r.json()).data.emergencies).toHaveLength(1);
});
