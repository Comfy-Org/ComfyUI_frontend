import type {
  BillingEventsResponse,
  ErrorResponse
} from '@comfyorg/ingest-types'
import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { CloudWorkspaceMockHelper } from '@e2e/fixtures/helpers/CloudWorkspaceMockHelper'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

const API_USAGE_EVENTS: BillingEventsResponse = {
  total: 1,
  events: [
    {
      event_type: 'api_usage_completed',
      event_id: 'usage-event-1',
      params: {
        api_name: 'Comfy API',
        model: 'flux-1.1-pro',
        amount: 420,
        run_id: 'run-e2e-42'
      },
      createdAt: '2099-01-18T12:34:00Z'
    }
  ],
  page: 1,
  limit: 7,
  totalPages: 1
}

const BILLING_EVENTS_FAILURE: ErrorResponse = {
  code: 'billing_events_unavailable',
  message: 'Billing events are temporarily unavailable'
}

async function openBillingActivity(page: Page): Promise<Locator> {
  await page.goto(APP_URL)
  await page.waitForFunction(() => !!window.app?.extensionManager, null, {
    timeout: 45_000
  })
  await page
    .getByRole('button', { name: /^Settings/ })
    .first()
    .click()

  const settings = page.getByTestId('settings-dialog')
  await expect(settings).toBeVisible()
  await settings.locator('nav').getByRole('button', { name: 'Credits' }).click()

  const content = settings.getByRole('main')
  await expect(content.getByRole('heading', { name: 'Activity' })).toBeVisible()
  return content
}

test.describe('Billing activity', { tag: '@cloud' }, () => {
  test.describe.configure({ timeout: 60_000 })

  test.describe('with an API usage event', () => {
    let content: Locator

    test.beforeEach(async ({ page }) => {
      await new CloudWorkspaceMockHelper(page).setup()
      await page.route('**/api/billing/events**', (route) =>
        route.fulfill({ json: API_USAGE_EVENTS })
      )
      content = await openBillingActivity(page)
    })

    test('TB-04 shows the completed run in Activity', async ({ page }) => {
      const eventRow = content.getByRole('row').filter({ hasText: 'Comfy API' })

      await expect(
        eventRow.getByText('API Usage', { exact: true })
      ).toBeVisible()
      await expect(
        eventRow.getByText('Comfy API', { exact: true })
      ).toBeVisible()
      await expect(eventRow.getByText('Model: flux-1.1-pro')).toBeVisible()
      await expect(eventRow).toContainText('Jan 18')

      await eventRow.getByRole('button', { name: 'Additional Info' }).hover()
      const tooltip = page.getByRole('tooltip')
      await expect(tooltip).toContainText('Amount: 420')
      await expect(tooltip).toContainText('Run Id: run-e2e-42')
    })
  })

  test.describe('when billing events are unavailable', () => {
    let content: Locator

    test.beforeEach(async ({ page }) => {
      await new CloudWorkspaceMockHelper(page).setup()
      await page.route('**/api/billing/events**', (route) =>
        route.fulfill({ status: 503, json: BILLING_EVENTS_FAILURE })
      )
      content = await openBillingActivity(page)
    })

    test('shows the localized Activity error', async () => {
      await expect(
        content.getByText(
          'Something went wrong while loading activity. Please refresh and try again.'
        )
      ).toBeVisible()
    })
  })
})
