import { expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type {
  BillingBalanceResponse,
  BillingEventsResponse,
  BillingPlansResponse,
  BillingStatusResponse,
  Member
} from '@/platform/workspace/api/workspaceApi'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { bootCloud, mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { mockWorkspace, workspace } from '@e2e/fixtures/utils/workspaceMocks'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'
const teamWorkspace = workspace('team', 'owner')
const teamMembers: Member[] = [
  {
    id: 'user-alice',
    name: 'Alice Owner',
    email: 'e2e@test.comfy.org',
    role: 'owner',
    joined_at: '2026-01-01T00:00:00Z',
    is_original_owner: true
  },
  {
    id: 'user-bob',
    name: 'Bob Member',
    email: 'bob@test.comfy.org',
    role: 'member',
    joined_at: '2026-01-02T00:00:00Z',
    is_original_owner: false
  }
]
const billingStatus: BillingStatusResponse = {
  is_active: true,
  subscription_tier: 'PRO',
  subscription_duration: 'MONTHLY',
  has_funds: true
}
const billingBalance: BillingBalanceResponse = {
  amount_micros: 10_000,
  effective_balance_micros: 10_000,
  currency: 'usd'
}
const billingPlans: BillingPlansResponse = { plans: [] }

function eventsResponse(
  events: BillingEventsResponse['events']
): BillingEventsResponse {
  return {
    total: events.length,
    events,
    page: 1,
    limit: 100,
    totalPages: events.length === 0 ? 0 : 1
  }
}

async function mockBillingShell(page: Page) {
  await page.route('**/api/billing/status', (route) =>
    route.fulfill(jsonRoute(billingStatus))
  )
  await page.route('**/api/billing/balance', (route) =>
    route.fulfill(jsonRoute(billingBalance))
  )
  await page.route('**/api/billing/plans', (route) =>
    route.fulfill(jsonRoute(billingPlans))
  )
}

async function bootWorkspace(page: Page) {
  await mockCloudBoot(page, {
    features: {
      team_workspaces_enabled: true,
      billing_control_enabled: true
    } satisfies RemoteConfig,
    settings: { 'Comfy.TutorialCompleted': true }
  })
  await mockWorkspace(page, teamWorkspace, teamMembers)
  await mockBillingShell(page)
  await bootCloud(page)
  await page.goto(APP_URL)
  await page.waitForFunction(() => !!window.app?.extensionManager, null, {
    timeout: 45_000
  })
  await page
    .getByRole('button', { name: /^Settings/ })
    .first()
    .click()
  const dialog = page.getByTestId('settings-dialog')
  await expect(dialog).toBeVisible()
  await dialog
    .locator('nav')
    .getByRole('button', { name: 'Plan & Credits' })
    .click()
  return dialog.getByRole('main')
}

function assertBillingEventsRequest(request: Request) {
  expect(request.method()).toBe('GET')
  expect(new URL(request.url()).pathname).toBe('/api/billing/events')
  expect(new URL(request.url()).search).toBe('')
  expect(request.headers().authorization).toBe('Bearer mock-workspace-token')
}

test.describe('Workspace Activity usage feed', { tag: '@cloud' }, () => {
  test('requests, renders, filters, and refreshes usage events', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const requests: Request[] = []
    const initialEvents = eventsResponse([
      {
        event_type: 'gpu_usage',
        event_id: 'gpu-event-unique-1',
        params: { user_id: 'user-alice' },
        createdAt: '2026-07-20T10:00:00Z'
      },
      {
        event_type: 'api_node_usage',
        event_id: 'api-event-unique-2',
        params: { user_id: 'user-bob', partner_node: 'Acme Upscaler' },
        createdAt: '2026-07-20T11:00:00Z'
      }
    ])
    const refreshedEvents = eventsResponse([
      ...initialEvents.events,
      {
        event_type: 'gpu_usage',
        event_id: 'gpu-event-unique-3',
        params: { user_id: 'user-bob' },
        createdAt: '2026-07-20T12:00:00Z'
      }
    ])
    await page.route('**/api/billing/events', async (route) => {
      requests.push(route.request())
      await route.fulfill(
        jsonRoute(requests.length === 1 ? initialEvents : refreshedEvents)
      )
    })

    const content = await bootWorkspace(page)
    await content.getByRole('button', { name: 'Activity' }).click()
    await expect.poll(() => requests.length).toBe(1)
    assertBillingEventsRequest(requests[0])
    await expect(content.getByText('Alice Owner')).toBeVisible()
    await expect(content.getByText('Bob Member')).toBeVisible()
    await expect(
      content.getByText('Cloud workflow run', { exact: true })
    ).toBeVisible()
    await expect(
      content.getByText('Partner node usage', { exact: true })
    ).toBeVisible()

    await content.getByPlaceholder('Search').fill('Alice')
    await expect(content.getByText('Alice Owner')).toBeVisible()
    await expect(content.getByText('Bob Member')).toBeHidden()
    await content.getByPlaceholder('Search').fill('')

    await content.getByRole('button', { name: 'Refresh' }).click()
    await expect.poll(() => requests.length).toBe(2)
    assertBillingEventsRequest(requests[1])
    await expect(content.getByText('Bob Member')).toHaveCount(2)
  })

  test('renders the empty response', async ({ page }) => {
    test.setTimeout(60_000)
    await page.route('**/api/billing/events', (route) =>
      route.fulfill(jsonRoute(eventsResponse([])))
    )

    const content = await bootWorkspace(page)
    await content.getByRole('button', { name: 'Activity' }).click()
    await expect(content.getByText('No activity yet.')).toBeVisible()
  })

  test('retries a failed request and renders the recovered event', async ({
    page
  }) => {
    test.setTimeout(60_000)
    let requestCount = 0
    const recovered = eventsResponse([
      {
        event_type: 'gpu_usage',
        event_id: 'retry-event-unique-1',
        params: { user_id: 'user-alice' },
        createdAt: '2026-07-20T13:00:00Z'
      }
    ])
    await page.route('**/api/billing/events', async (route) => {
      requestCount += 1
      if (requestCount === 1) {
        await route.fulfill({ status: 503 })
        return
      }
      await route.fulfill(jsonRoute(recovered))
    })

    const content = await bootWorkspace(page)
    await content.getByRole('button', { name: 'Activity' }).click()
    await expect(content.getByRole('alert')).toContainText(
      'Failed to load activity. Please try again.'
    )
    await content.getByRole('button', { name: 'Try again' }).click()
    await expect.poll(() => requestCount).toBe(2)
    await expect(content.getByText('Alice Owner')).toBeVisible()
  })
})
