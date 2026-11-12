import type { Request } from '@playwright/test'
import { expect } from '@playwright/test'

import type {
  BillingHandoffCreateResponse,
  CreateTopupQuoteRequest,
  ErrorResponse,
  ListSavedPaymentMethodsResponse,
  TopupQuoteResponse
} from '@comfyorg/ingest-types'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

import { WORKSPACE_SWITCHER_REMOTE_CONFIG } from '@e2e/fixtures/data/workspaceSwitcher'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { workspaceSwitcherTest } from '@e2e/fixtures/workspaceSwitcherFixture'

const CLOUD_BASE_URL = 'https://cloud.local-billing.test'
const BILLING_WEB_ORIGIN = 'https://billing.local-billing.test'
export const ENTRY_URL = `${BILLING_WEB_ORIGIN}/handoff#token=one-time-handoff`
export const WORKSPACE_ID = 'ws-personal'
export const OWNER_ONLY_MESSAGE = 'Only the workspace owner can open billing'

function base64Url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

export const LOCAL_WEB_ACCESS_TOKEN = [
  base64Url({ alg: 'none', typ: 'JWT' }),
  base64Url({
    sub: 'local-web-user',
    email: 'local-web@example.com',
    workspace_id: WORKSPACE_ID
  }),
  'unsigned'
].join('.')

type HandoffReply =
  | { status: 200; body: BillingHandoffCreateResponse }
  | { status: 403; body: ErrorResponse }

const ISSUED: HandoffReply = {
  status: 200,
  body: {
    entry_url: ENTRY_URL,
    expires_at: '2099-01-01T00:00:00Z',
    request_id: 'handoff-request-1'
  }
}

export const OWNER_ONLY: HandoffReply = {
  status: 403,
  body: { code: 'BILLING_FORBIDDEN', message: OWNER_ONLY_MESSAGE }
}

/** Local ComfyUI signed in through local web OAuth, with Cloud's `local_billing_web` flag and handoff issuance mocked. */
export const localWebBillingHandoffTest = workspaceSwitcherTest.extend<{
  localBillingWeb: boolean
  handoffReply: HandoffReply
  handoffRequests: Request[]
  cloudFlagReads: Request[]
  openAddCredits: () => Promise<void>
}>({
  localBillingWeb: [false, { option: true }],
  handoffReply: [ISSUED, { option: true }],
  handoffRequests: async ({ browserName: _browserName }, use) => {
    await use([])
  },
  cloudFlagReads: async ({ browserName: _browserName }, use) => {
    await use([])
  },
  openAddCredits: async ({ page, cloudFlagReads }, use) => {
    await use(async () => {
      await expect
        .poll(() => cloudFlagReads.length, 'Cloud flag never read')
        .toBeGreaterThan(0)
      await page.getByRole('button', { name: 'Current user' }).click()
      await page.getByRole('button', { name: /^Credits/ }).hover()
      await page.getByRole('button', { name: 'Add credits' }).click()
    })
  },
  page: async (
    { page, localBillingWeb, handoffReply, handoffRequests, cloudFlagReads },
    use
  ) => {
    await page.route('**/api/features', (route) =>
      route.fulfill(
        jsonRoute({
          ...WORKSPACE_SWITCHER_REMOTE_CONFIG,
          local_web_sso: true,
          comfy_cloud_base_url: CLOUD_BASE_URL
        } satisfies RemoteConfig)
      )
    )
    await page.route(`${CLOUD_BASE_URL}/api/features`, async (route) => {
      await route.fulfill(jsonRoute({ local_billing_web: localBillingWeb }))
      cloudFlagReads.push(route.request())
    })
    await page.route(`${CLOUD_BASE_URL}/api/auth/handoffs`, (route) => {
      handoffRequests.push(route.request())
      return route.fulfill({
        status: handoffReply.status,
        contentType: 'application/json',
        body: JSON.stringify(handoffReply.body)
      })
    })
    await page.route('**/api/billing/payment-methods', (route) =>
      route.fulfill({ json: [] satisfies ListSavedPaymentMethodsResponse })
    )
    await page.route('**/api/billing/topup/quote', (route) => {
      const { amount_cents } = route
        .request()
        .postDataJSON() as CreateTopupQuoteRequest
      return route.fulfill({
        json: {
          amount_cents,
          credits: Math.round(amount_cents * 2.11),
          expires_at: '2099-01-01T00:00:00Z'
        } satisfies TopupQuoteResponse
      })
    })
    await page.context().route(`${BILLING_WEB_ORIGIN}/**`, (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<title>Billing</title><h1>Billing</h1>'
      })
    )
    await page.addInitScript((accessToken) => {
      localStorage.setItem(
        'Comfy.LocalWebSignIn.Tokens',
        JSON.stringify({
          accessToken,
          refreshToken: 'local-web-refresh-token',
          expiresAt: Date.now() + 60 * 60 * 1000,
          scope: 'openid'
        })
      )
    }, LOCAL_WEB_ACCESS_TOKEN)

    await use(page)
  }
})
