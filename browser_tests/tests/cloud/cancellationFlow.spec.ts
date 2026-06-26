import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { CancelSubscriptionDialog } from '@e2e/fixtures/components/CancelSubscriptionDialog'

import type { ChurnkeyInitConfig } from '@/platform/cloud/churnkey/types'
import type { ChurnkeyAuthResponse } from '@/platform/workspace/api/workspaceApi'

const CANCEL_AT = '2026-12-31T12:00:00Z'
const STUB_APP_ID = 'e2e-stub'

const VALID_AUTH_RESPONSE = {
  customer_id: 'cus_e2e_test',
  auth_hash: 'fake-hmac',
  mode: 'test'
} satisfies ChurnkeyAuthResponse

// The production router's catch-all body for undeployed routes (verified
// against cloud.comfy.org) — what the frontend sees until the backend
// ships the endpoint.
const NOT_DEPLOYED_RESPONSE = {
  error: { message: 'Not Found', type: 'not_found' }
}

interface ChurnkeyInitCall {
  action: string
  config: ChurnkeyInitConfig
}

interface ChurnkeyStubWindow extends Window {
  __churnkeyCalls?: ChurnkeyInitCall[]
}

async function stubChurnkey(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as ChurnkeyStubWindow
    w.__churnkeyCalls = []
    // Defining `init` up front also makes the client skip injecting the
    // real embed script.
    w.churnkey = {
      created: true,
      init: (action, config) => {
        w.__churnkeyCalls!.push({ action, config })
      },
      clearState: () => {}
    }
  })
}

const AUTH_ROUTE_GLOB = '**/api/billing/churnkey/auth'

async function mockAuthEndpoint(
  page: Page,
  fulfill:
    | { status: 200; body: ChurnkeyAuthResponse }
    | { status: 404; body: typeof NOT_DEPLOYED_RESPONSE }
): Promise<void> {
  await page.route(AUTH_ROUTE_GLOB, (route) =>
    route.fulfill({
      status: fulfill.status,
      contentType: 'application/json',
      body: JSON.stringify(fulfill.body)
    })
  )
}

async function getChurnkeyInitCalls(page: Page): Promise<ChurnkeyInitCall[]> {
  return page.evaluate(
    () => (window as ChurnkeyStubWindow).__churnkeyCalls ?? []
  )
}

test.describe('Cancellation flow routing', { tag: '@cloud' }, () => {
  let dialog: CancelSubscriptionDialog

  test.use({ timezoneId: 'UTC' })

  test.beforeEach(async ({ comfyPage }) => {
    dialog = new CancelSubscriptionDialog(comfyPage.page)
  })

  test.describe('app id not set', () => {
    test('routes to the legacy cancel dialog', async ({ comfyPage }) => {
      await comfyPage.featureFlags.overrideFlags({
        churnkey_app_id: ''
      })

      await dialog.open(CANCEL_AT)

      await expect(dialog.heading).toBeVisible()
      await expect(dialog.root).toContainText('December 31, 2026')
    })
  })

  test.describe('app id set', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.featureFlags.overrideFlags({
        churnkey_app_id: STUB_APP_ID
      })
      await stubChurnkey(comfyPage.page)
    })

    test('routes to the legacy dialog when auth endpoint 404s', async ({
      comfyPage
    }) => {
      await mockAuthEndpoint(comfyPage.page, {
        status: 404,
        body: NOT_DEPLOYED_RESPONSE
      })

      await dialog.open(CANCEL_AT)

      await expect(dialog.heading).toBeVisible()
      expect(await getChurnkeyInitCalls(comfyPage.page)).toEqual([])
    })

    test('launches the Churnkey embed when auth returns valid credentials', async ({
      comfyPage
    }) => {
      await mockAuthEndpoint(comfyPage.page, {
        status: 200,
        body: VALID_AUTH_RESPONSE
      })

      await dialog.launch(CANCEL_AT)

      await expect
        .poll(() => getChurnkeyInitCalls(comfyPage.page).then((c) => c.length))
        .toBeGreaterThan(0)

      const [firstCall] = await getChurnkeyInitCalls(comfyPage.page)
      expect(firstCall.action).toBe('show')
      expect(firstCall.config).toMatchObject({
        authHash: 'fake-hmac',
        customerId: 'cus_e2e_test',
        mode: 'test',
        provider: 'stripe'
      })

      await expect(dialog.root).toBeHidden()
    })
  })
})
