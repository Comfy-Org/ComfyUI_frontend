import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { CancelSubscriptionDialog } from '@e2e/fixtures/components/CancelSubscriptionDialog'

import type { ChurnkeyInitConfig } from '@/platform/cloud/churnkey/types'

const CANCEL_AT = '2026-12-31T12:00:00Z'
const STUB_APP_ID = 'e2e-stub'

const VALID_AUTH_RESPONSE = {
  customer_id: 'cus_e2e_test',
  auth_hash: 'fake-hmac',
  mode: 'test'
}

interface ChurnkeyInitCall {
  action: string
  config: ChurnkeyInitConfig
}

interface ChurnkeyStubWindow extends Window {
  __churnkeyCalls?: ChurnkeyInitCall[]
  __CHURNKEY_APP_ID_OVERRIDE__?: string
}

async function stubChurnkey(page: Page): Promise<void> {
  await page.evaluate((appId) => {
    const w = window as ChurnkeyStubWindow
    w.__CHURNKEY_APP_ID_OVERRIDE__ = appId
    w.__churnkeyCalls = []
    w.churnkey = {
      created: true,
      init: (action, config) => {
        w.__churnkeyCalls!.push({ action, config })
      },
      clearState: () => {}
    }
  }, STUB_APP_ID)
}

const AUTH_ROUTE_GLOB = '**/api/billing/churnkey/auth'

async function mockAuthEndpoint(
  page: Page,
  fulfill: { status: number; body: object }
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

  test.beforeEach(async ({ comfyPage }) => {
    dialog = new CancelSubscriptionDialog(comfyPage.page)
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.page.unroute(AUTH_ROUTE_GLOB)
  })

  test.describe('flag disabled', () => {
    test('routes to the legacy cancel dialog', async ({ comfyPage }) => {
      await comfyPage.featureFlags.setServerFeatures({
        churnkey_cancellation_enabled: false
      })

      await dialog.open(CANCEL_AT)

      await expect(dialog.heading).toBeVisible()
      await expect(dialog.root).toContainText('December 31, 2026')
    })
  })

  test.describe('flag enabled', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.featureFlags.setServerFeatures({
        churnkey_cancellation_enabled: true
      })
      await stubChurnkey(comfyPage.page)
    })

    test('routes to the legacy dialog when auth endpoint 404s', async ({
      comfyPage
    }) => {
      await mockAuthEndpoint(comfyPage.page, {
        status: 404,
        body: { code: 'NOT_FOUND', message: 'endpoint not deployed' }
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

      await dialog.open(CANCEL_AT, false)

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
