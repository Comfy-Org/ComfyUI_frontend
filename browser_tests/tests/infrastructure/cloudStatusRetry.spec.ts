import { expect } from '@playwright/test'
import type { Request } from '@playwright/test'

import {
  cloudAppFixture as test,
  waitForCloudApp
} from '@e2e/fixtures/cloudAppFixture'
import { DEFAULT_TEAM_MEMBERS } from '@e2e/fixtures/data/cloudWorkspace'
import { CloudWorkspaceMockHelper } from '@e2e/fixtures/helpers/CloudWorkspaceMockHelper'
import {
  CAPABILITIES_ROUTE,
  STATUS_RETRY_PROBE_ROUTE,
  fetchThroughApp,
  fulfillUnavailable,
  recordFinishedCapabilityReads,
  routeUnavailableGets
} from '@e2e/fixtures/utils/statusRetryRoutes'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

test.describe('Shared request status retry', { tag: '@cloud' }, () => {
  test.describe.configure({ timeout: 60_000 })

  let workspace: CloudWorkspaceMockHelper

  test.beforeEach(async ({ page }) => {
    workspace = new CloudWorkspaceMockHelper(page)
    await workspace.setup(DEFAULT_TEAM_MEMBERS)
  })

  test('renders a billing read that recovered from a 503', async ({ page }) => {
    const capabilityReads = await routeUnavailableGets(
      page,
      CAPABILITIES_ROUTE,
      1
    )

    const content = await workspace.openPlanAndCreditsSettings()

    await expect(
      content.getByRole('button', { name: 'Add credits' })
    ).toBeVisible()
    expect(capabilityReads.length).toBeGreaterThanOrEqual(2)
  })

  test('keeps credits locked when the billing read stays unavailable', async ({
    page
  }) => {
    await routeUnavailableGets(
      page,
      CAPABILITIES_ROUTE,
      Number.POSITIVE_INFINITY
    )
    const finishedReads = recordFinishedCapabilityReads(page)

    const content = await workspace.openPlanAndCreditsSettings()

    await expect(content.getByText('Total credits')).toBeVisible()
    await expect.poll(() => finishedReads.length).toBeGreaterThanOrEqual(3)
    await expect(
      content.getByRole('button', { name: 'Add credits' })
    ).toHaveCount(0)
  })

  test('stops a read after three attempts and returns the last 503', async ({
    page
  }) => {
    await page.goto(APP_URL)
    await waitForCloudApp(page)
    const reads = await routeUnavailableGets(
      page,
      STATUS_RETRY_PROBE_ROUTE,
      Number.POSITIVE_INFINITY
    )

    const status = await fetchThroughApp(page, '/status-retry-probe', 'GET')

    expect(status).toBe(503)
    expect(reads).toHaveLength(3)
  })

  test('returns the answer of a read that recovered on retry', async ({
    page
  }) => {
    await page.goto(APP_URL)
    await waitForCloudApp(page)
    const reads = await routeUnavailableGets(
      page,
      STATUS_RETRY_PROBE_ROUTE,
      1,
      (route) => route.fulfill({ json: { ok: true } })
    )

    const status = await fetchThroughApp(page, '/status-retry-probe', 'GET')

    expect(status).toBe(200)
    expect(reads).toHaveLength(2)
  })

  test('sends a write answered 503 once', async ({ page }) => {
    await page.goto(APP_URL)
    await waitForCloudApp(page)
    const writes: Request[] = []
    await page.route(STATUS_RETRY_PROBE_ROUTE, (route) => {
      writes.push(route.request())
      return fulfillUnavailable(route)
    })

    const status = await fetchThroughApp(page, '/status-retry-probe', 'POST')

    expect(status).toBe(503)
    expect(writes).toHaveLength(1)
  })
})
