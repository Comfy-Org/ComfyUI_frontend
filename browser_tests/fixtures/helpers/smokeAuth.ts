import type { Page } from '@playwright/test'

export const SMOKE_ENV_VARS = [
  'SMOKE_ACCOUNT_EMAIL',
  'SMOKE_ACCOUNT_PASSWORD'
] as const

export function missingSmokeEnvVars(
  env: Record<string, string | undefined>
): string[] {
  return SMOKE_ENV_VARS.filter((name) => !env[name])
}

async function bypassOnboardingSurvey(page: Page): Promise<void> {
  await page.route('**/settings/onboarding_survey', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue()
      return
    }
    console.warn(`[cloud] survey gate intercepted: ${route.request().url()}`)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ value: { completed_by: 'e2e-smoke-fixture' } })
    })
  })
}

export async function signInSmokeUser(
  page: Page,
  appUrl: string
): Promise<void> {
  const missing = missingSmokeEnvVars(process.env)
  if (missing.length > 0)
    throw new Error(
      `CUSTOM_NODES_ENV=cloud needs ${SMOKE_ENV_VARS.join(', ')} in the ` +
        `environment to sign in the smoke user; missing: ${missing.join(', ')}`
    )

  await bypassOnboardingSurvey(page)

  await page.goto(`${appUrl}/cloud/login`)
  await page.getByRole('button', { name: 'Use email instead' }).click()
  await page
    .locator('#cloud-sign-in-email')
    .fill(process.env.SMOKE_ACCOUNT_EMAIL!)
  await page
    .locator('#cloud-sign-in-password')
    .fill(process.env.SMOKE_ACCOUNT_PASSWORD!)
  await page.locator('button[type="submit"]').click()

  await page.waitForURL((url) => !url.pathname.startsWith('/cloud/login'))
}
