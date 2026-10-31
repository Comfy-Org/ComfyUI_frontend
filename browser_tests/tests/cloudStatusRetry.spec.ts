import { expect } from '@playwright/test'
import type { Page, Request, Route } from '@playwright/test'

import { cloudAppFixture as test } from '@e2e/fixtures/cloudAppFixture'
import { DEFAULT_TEAM_MEMBERS } from '@e2e/fixtures/data/cloudWorkspace'
import { CloudWorkspaceMockHelper } from '@e2e/fixtures/helpers/CloudWorkspaceMockHelper'

const CAPABILITIES_ROUTE = '**/api/billing/capabilities'

function unavailable(route: Route) {
  return route.fulfill({
    status: 503,
    headers: { 'Retry-After': '0' },
    json: { message: 'Billing temporarily unavailable, please retry' }
  })
}

function recordGets(page: Page, routeGlob: string): Request[] {
  const pattern = new RegExp(routeGlob.replaceAll('**', '.*'))
  const gets: Request[] = []
  page.on('request', (request) => {
    if (request.method() === 'GET' && pattern.test(request.url())) {
      gets.push(request)
    }
  })
  return gets
}

test.describe('Shared request status retry', { tag: '@cloud' }, () => {
  test.describe.configure({ timeout: 60_000 })

  test('retries a read answered 503 and renders the recovered answer', async ({
    page
  }) => {
    const workspace = new CloudWorkspaceMockHelper(page)
    await workspace.setup(DEFAULT_TEAM_MEMBERS)
    let unavailableAnswers = 0
    await page.route(CAPABILITIES_ROUTE, (route) => {
      if (route.request().method() !== 'GET' || unavailableAnswers > 0) {
        return route.fallback()
      }
      unavailableAnswers += 1
      return unavailable(route)
    })
    const capabilityReads = recordGets(page, CAPABILITIES_ROUTE)

    const content = await workspace.openPlanAndCreditsSettings()

    await expect(
      content.getByRole('button', { name: 'Add credits' })
    ).toBeVisible()
    expect(unavailableAnswers).toBe(1)
    expect(capabilityReads.length).toBeGreaterThanOrEqual(2)
  })

  test('stops after three attempts when the read stays unavailable', async ({
    page
  }) => {
    const workspace = new CloudWorkspaceMockHelper(page)
    await workspace.setup(DEFAULT_TEAM_MEMBERS)
    await page.route(CAPABILITIES_ROUTE, (route) =>
      route.request().method() === 'GET' ? unavailable(route) : route.fallback()
    )
    const capabilityReads = recordGets(page, CAPABILITIES_ROUTE)

    const content = await workspace.openPlanAndCreditsSettings()

    await expect(content.getByText('Total credits')).toBeVisible()
    await expect(
      content.getByRole('button', { name: 'Add credits' })
    ).toHaveCount(0)
    await expect.poll(() => capabilityReads.length).toBeGreaterThanOrEqual(3)
    expect(capabilityReads.length % 3).toBe(0)
  })

  test('sends a write answered 503 once and returns that answer', async ({
    page
  }) => {
    const workspace = new CloudWorkspaceMockHelper(page)
    await workspace.setup(DEFAULT_TEAM_MEMBERS)
    await workspace.openPlanAndCreditsSettings()
    const writes: Request[] = []
    await page.route('**/api/status-retry-probe', (route) => {
      writes.push(route.request())
      return unavailable(route)
    })

    const status = await page.evaluate(async () => {
      const response = await window.app!.api.fetchApi('/status-retry-probe', {
        method: 'POST',
        body: '{}'
      })
      return response.status
    })

    expect(status).toBe(503)
    expect(writes).toHaveLength(1)
  })

  test('retries an app read on the cloud transport', async ({ page }) => {
    const workspace = new CloudWorkspaceMockHelper(page)
    await workspace.setup(DEFAULT_TEAM_MEMBERS)
    await workspace.openPlanAndCreditsSettings()
    const reads: Request[] = []
    await page.route('**/api/status-retry-probe', (route) => {
      reads.push(route.request())
      return reads.length === 1
        ? unavailable(route)
        : route.fulfill({ json: { ok: true } })
    })

    const status = await page.evaluate(async () => {
      const response = await window.app!.api.fetchApi('/status-retry-probe')
      return response.status
    })

    expect(status).toBe(200)
    expect(reads).toHaveLength(2)
  })
})
