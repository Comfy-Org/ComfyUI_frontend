import type { Route } from '@playwright/test'
import { test as base } from '@playwright/test'

import type {
  BillingBalanceResponse,
  BillingEventsResponse,
  BillingPlansResponse,
  BillingStatusResponse,
  CurrentWorkspaceResponse
} from '@comfyorg/ingest-types'
import { formatCreditsFromCents } from '@/base/credits/comfyCredits'
import type { operations } from '@/types/comfyRegistryTypes'
import { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

type CreateCustomerResponse =
  operations['createCustomer']['responses']['201']['content']['application/json']

const E2E_API_KEY = 'comfyui-e2e-api-key'

// Workspace-rail mocks authenticate like the real API: a request that does
// not carry the stored key as X-API-KEY gets a 401 instead of data, so the
// suite fails if the client stops wiring the credential through.
const fulfillForApiKey = <T>(route: Route, body: T) =>
  route.request().headers()['x-api-key'] === E2E_API_KEY
    ? route.fulfill(jsonRoute(body))
    : route.fulfill({
        status: 401,
        json: { code: 'UNAUTHORIZED', message: 'X-API-KEY required' }
      })

export const API_KEY_WORKSPACE: CurrentWorkspaceResponse = {
  id: 'ws-api-key-team',
  name: 'API Key Team',
  type: 'team',
  role: 'owner',
  auth_method: 'cloud_api_key'
}

const API_KEY_BALANCE_CENTS = 123_400

export const API_KEY_BALANCE_DISPLAY = formatCreditsFromCents({
  cents: API_KEY_BALANCE_CENTS,
  locale: 'en',
  numberOptions: { minimumFractionDigits: 0, maximumFractionDigits: 2 }
})

const API_KEY_WORKSPACE_EVENT_ID = 'evt-api-key-workspace'

/**
 * Boots the local (non-Cloud) build as an API-key-only session: no Firebase
 * user, a stored `comfy_api_key`, and the cloud API resolving that key to a
 * single bound workspace. Mirrors the QA flow behind the 1.51 API-key billing
 * findings: workspace context, balance, and activity must all come from the
 * key's workspace via `/api/workspaces/current` and `/api/billing/*`, never
 * from the legacy user-scoped `/customers/*` rail.
 *
 * The fixture records any legacy-rail read so specs can assert the session
 * never falls back to it.
 */
export const apiKeyAuthFixture = base.extend<{
  comfyPage: ComfyPage
  legacyBillingReads: string[]
}>({
  legacyBillingReads: async ({ page }, use) => {
    const reads: string[] = []
    await page.route('**/customers/balance', (route) => {
      reads.push(route.request().url())
      return route.fulfill(jsonRoute({ amount_micros: 0, currency: 'usd' }))
    })
    await page.route('**/customers/events**', (route) => {
      reads.push(route.request().url())
      return route.fulfill(
        jsonRoute({ events: [], page: 1, limit: 7, total: 0, totalPages: 0 })
      )
    })
    await use(reads)
  },
  comfyPage: async ({ page, request, legacyBillingReads }, use, testInfo) => {
    testInfo.setTimeout(45_000)
    void legacyBillingReads

    const comfyPage = new ComfyPage(page, request)
    const userId = await comfyPage.setupUser(
      `playwright-api-key-${testInfo.parallelIndex}`
    )
    await comfyPage.setupSettings({
      'Comfy.TutorialCompleted': true,
      'Comfy.userId': userId
    })

    await page.route('**/customers', (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      return route.fulfill({
        status: 201,
        json: { id: 'api-key-user-e2e' } satisfies CreateCustomerResponse
      })
    })
    await page.route('**/api/workspaces/current', (route) =>
      fulfillForApiKey(route, API_KEY_WORKSPACE)
    )
    await page.route('**/api/billing/status', (route) =>
      fulfillForApiKey(route, {
        billing_rail: 'stripe',
        billing_status: 'paid',
        has_funds: true,
        is_active: true,
        max_seats: 50,
        occupied_seats: 1,
        subscription_status: 'active',
        subscription_tier: 'TEAM',
        team_credit_stop: null
      } satisfies BillingStatusResponse)
    )
    await page.route('**/api/billing/balance', (route) =>
      fulfillForApiKey(route, {
        amount_micros: API_KEY_BALANCE_CENTS,
        currency: 'usd',
        effective_balance_micros: API_KEY_BALANCE_CENTS
      } satisfies BillingBalanceResponse)
    )
    await page.route('**/api/billing/plans', (route) =>
      fulfillForApiKey(route, { plans: [] } satisfies BillingPlansResponse)
    )
    await page.route('**/api/billing/events**', (route) =>
      fulfillForApiKey(route, {
        events: [
          {
            event_id: API_KEY_WORKSPACE_EVENT_ID,
            event_type: 'credit_added',
            createdAt: '2026-08-25T00:00:00Z',
            params: { amount: API_KEY_BALANCE_CENTS }
          }
        ],
        page: 1,
        limit: 7,
        total: 1,
        totalPages: 1
      } satisfies BillingEventsResponse)
    )

    await page.addInitScript(
      ({ id, key }) => {
        if (localStorage.getItem('Comfy.userId') !== id) {
          localStorage.clear()
          sessionStorage.clear()
          localStorage.setItem('Comfy.userId', id)
          localStorage.setItem('comfy_api_key', key)
        }
      },
      { id: userId, key: E2E_API_KEY }
    )

    await comfyPage.goto()
    await page.waitForFunction(() => document.fonts.ready)
    await comfyPage.waitForAppReady()

    await use(comfyPage)
  }
})
