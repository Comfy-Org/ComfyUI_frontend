import { expect } from '@playwright/test'
import type { Page, Request } from '@playwright/test'

import type { BillingStatusResponse } from '@comfyorg/billing-core'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { CancelSubscriptionDialog } from '@e2e/fixtures/components/CancelSubscriptionDialog'
import { createBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import { mockSystemStats } from '@e2e/fixtures/data/systemStats'
import { CloudAuthHelper } from '@e2e/fixtures/helpers/CloudAuthHelper'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { mockWebSessionServer } from '@e2e/fixtures/utils/webSessionMocks'
import {
  mockWorkspaceList,
  mockWorkspaceTokenMint,
  workspace
} from '@e2e/fixtures/utils/workspaceMocks'

/**
 * Cancel subscription across the billing SDK rail — FE-2216.
 *
 * Both rails POST the same route, so the recorded request is what separates
 * them: only the SDK transport sends an `Idempotency-Key` header. Drives a raw
 * `page` so the cloud app boots against fully mocked endpoints, the same
 * pattern as billingFacadeConsumers.spec.ts.
 */
const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

const SUBSCRIPTION_STATUS: BillingStatusResponse = {
  is_active: true,
  has_funds: true,
  subscription_status: 'active',
  subscription_tier: 'PRO',
  subscription_duration: 'MONTHLY',
  billing_status: 'paid',
  max_seats: 1,
  occupied_seats: 1,
  ended_at: null,
  team_credit_stop: null,
  scheduled_change: null,
  next_charge: null,
  plan_slug: 'pro-monthly',
  renewal_date: '2099-02-20T10:00:00Z'
}

interface CancelRoute {
  /** Every POST the app made to the cancel route, in order. */
  readonly requests: Request[]
  /** Answers the next POST with a 404, as a backend whose gate is closed does. */
  respondNotFound: () => void
}

async function mockCloudBoot(page: Page): Promise<CancelRoute> {
  const requests: Request[] = []
  let notFound = false

  await page.route('**/api/features', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/system_stats', (r) =>
    r.fulfill(jsonRoute(mockSystemStats))
  )
  await page.route('**/api/users', (r) =>
    r.fulfill(
      jsonRoute({
        storage: 'server',
        migrated: true,
        users: { 'test-user-e2e': 'E2E Test User' }
      })
    )
  )
  await page.route('**/api/settings', (r) =>
    r.fulfill(jsonRoute({ 'Comfy.TutorialCompleted': true }))
  )
  await page.route('**/api/userdata**', (r) => r.fulfill(jsonRoute([])))
  await page.route('**/api/extensions', (r) => r.fulfill(jsonRoute([])))
  await page.route('**/api/object_info', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/global_subgraphs', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/i18n', (r) => r.fulfill(jsonRoute({})))
  await mockWebSessionServer(page)
  await page.route('**/releases**', (r) => r.fulfill(jsonRoute([])))
  await mockWorkspaceTokenMint(page, workspace('personal', 'owner'))
  await mockWorkspaceList(page, [workspace('personal', 'owner')])

  await page.route('**/api/billing/status', (r) =>
    r.fulfill(jsonRoute(SUBSCRIPTION_STATUS))
  )
  await page.route('**/api/billing/balance', (r) =>
    r.fulfill(jsonRoute({ amount_micros: 0, currency: 'usd' }))
  )
  await page.route('**/api/billing/plans', (r) =>
    r.fulfill(jsonRoute({ plans: [] }))
  )
  await page.route('**/api/billing/capabilities', (r) =>
    r.fulfill(
      jsonRoute(createBillingCapabilities('ws-personal', { can_cancel: true }))
    )
  )

  await page.route('**/api/billing/subscription/cancel', async (r) => {
    requests.push(r.request())
    if (notFound) {
      notFound = false
      await r.fulfill({ status: 404, body: '' })
      return
    }
    await r.fulfill(
      jsonRoute({ billing_op_id: 'op-cancel-1', status: 'pending' })
    )
  })
  await page.route('**/api/billing/ops/**', (r) =>
    r.fulfill(
      jsonRoute({
        id: 'op-cancel-1',
        status: 'succeeded',
        started_at: '2026-01-01T00:00:00Z',
        completed_at: '2026-01-01T00:00:05Z'
      })
    )
  )

  return {
    requests,
    respondNotFound: () => {
      notFound = true
    }
  }
}

async function bootApp(page: Page) {
  await new CloudAuthHelper(page).mockAuth()
  await page.addInitScript(() => {
    localStorage.setItem('Comfy.userId', 'test-user-e2e')
  })
  await page.goto(APP_URL)
  await page.waitForFunction(() => !!window.app?.extensionManager, null, {
    timeout: 45_000
  })
}

/** The SDK transport sends this header; the legacy axios client never does. */
function idempotencyKey(request: Request): string | undefined {
  return request.headers()['idempotency-key']
}

test.describe('Cancel subscription rail (FE-2216)', { tag: '@cloud' }, () => {
  test('issues through the SDK transport while the rail is on', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const cancelRoute = await mockCloudBoot(page)
    await bootApp(page)

    const dialog = new CancelSubscriptionDialog(page)
    await dialog.open('2099-12-31T12:00:00Z')
    await dialog.confirmCancel()
    expect(cancelRoute.requests).toHaveLength(1)
    const [issued] = cancelRoute.requests
    expect(issued.method()).toBe('POST')
    expect(idempotencyKey(issued)).toBeTruthy()
    expect(issued.postDataJSON()).toMatchObject({
      idempotency_key: idempotencyKey(issued)
    })
  })

  test('falls back to the legacy call when the SDK route answers 404', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const cancelRoute = await mockCloudBoot(page)
    await bootApp(page)
    cancelRoute.respondNotFound()

    const dialog = new CancelSubscriptionDialog(page)
    await dialog.open('2099-12-31T12:00:00Z')
    await dialog.confirmCancel()
    await expect.poll(() => cancelRoute.requests.length).toBe(2)
    const [sdkAttempt, legacyAttempt] = cancelRoute.requests
    expect(idempotencyKey(sdkAttempt)).toBeTruthy()
    expect(idempotencyKey(legacyAttempt)).toBeUndefined()
  })
})
