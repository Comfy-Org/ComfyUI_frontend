import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

const PLATFORM_PLANS_PATH = '/profile/billing/plans'

/** Serves the platform Plans page locally, runs `open`, and returns the tab it opened. */
export async function expectPlatformPlansOpened(
  page: Page,
  open: () => Promise<void>
): Promise<Page> {
  await page
    .context()
    .route(`**${PLATFORM_PLANS_PATH}**`, (route) =>
      route.fulfill({ contentType: 'text/html', body: 'Plans' })
    )
  const opened = page.context().waitForEvent('page')
  await open()
  const plans = await opened
  await expect
    .poll(() => new URL(plans.url()).pathname)
    .toBe(PLATFORM_PLANS_PATH)
  expect(new URL(plans.url()).origin, 'opens on the platform host').not.toBe(
    new URL(page.url()).origin
  )
  await expect(
    page.locator('[data-dialog-key="subscription-required"]')
  ).toHaveCount(0)
  return plans
}
