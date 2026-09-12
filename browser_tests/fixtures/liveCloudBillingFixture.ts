import {
  zBillingOpStatusResponse,
  zBillingStatusResponse,
  zCurrentWorkspaceResponse,
  zListSavedPaymentMethodsResponse,
  zPreviewSubscribeResponse
} from '@comfyorg/ingest-types/zod'
import type { z } from 'zod'

import {
  ComfyPage,
  comfyExpect as expect,
  comfyPageFixture as base
} from '@e2e/fixtures/ComfyPage'
import { FeatureFlagHelper } from '@e2e/fixtures/helpers/FeatureFlagHelper'
import { loadLiveCloudBillingConfig } from '@e2e/fixtures/utils/liveCloudBillingConfig'

interface BillingSandbox {
  preview: z.infer<typeof zPreviewSubscribeResponse>
  readOperation: (
    operationId: string
  ) => Promise<z.infer<typeof zBillingOpStatusResponse>>
}

export const liveCloudBillingFixture = base.extend<{
  billingSandbox: BillingSandbox
}>({
  baseURL: process.env.PLAYWRIGHT_TEST_URL,
  networkPolicy: async ({ baseURL }, use) => {
    const sandbox = loadLiveCloudBillingConfig()
    const origins = new Set([
      new URL(baseURL ?? sandbox.PLAYWRIGHT_TEST_URL).origin,
      sandbox.PLAYWRIGHT_SETUP_API_URL,
      'https://testapi.comfy.org',
      'https://t.comfy.org',
      'https://mp.comfy.org',
      'https://browser-intake-us5-datadoghq.com',
      'https://cdn.sy-d.io',
      'https://e2.sy-d.io',
      'https://consumer.cloud.gist.build',
      'https://realtime.cloud.gist.build',
      'https://cdp.customer.io',
      'https://o4507954455314432.ingest.us.sentry.io',
      'https://identitytoolkit.googleapis.com',
      'https://securetoken.googleapis.com',
      'https://dreamboothy-dev.firebaseapp.com',
      'https://checkout.stripe.com',
      'https://api.stripe.com',
      'https://js.stripe.com',
      'https://m.stripe.network',
      'https://m.stripe.com',
      'https://r.stripe.com',
      'https://q.stripe.com',
      'https://b.stripecdn.com'
    ])
    const unexpected = new Set<string>()
    await use({ origins, unexpected })
    expect(
      [...unexpected],
      'Add the required sandbox dependency origin'
    ).toEqual([])
  },
  billingSandbox: async ({ page }, use, testInfo) => {
    const sandbox = loadLiveCloudBillingConfig()
    await new FeatureFlagHelper(page).seedFlags({
      onboarding_survey_enabled: false
    })
    const documentResponse = await page.goto(
      `${sandbox.PLAYWRIGHT_TEST_URL}/cloud/login`
    )
    await page
      .getByRole('button', { name: 'Use email instead', exact: true })
      .click()
    await page
      .getByRole('textbox', { name: 'Email', exact: true })
      .fill(sandbox.CLOUD_ACCOUNT_EMAIL)
    await page
      .getByLabel('Password', { exact: true })
      .fill(sandbox.CLOUD_ACCOUNT_PASSWORD)
    const [billingResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/api/billing/status' &&
          response.status() === 200
      ),
      page.getByRole('button', { name: 'Sign in', exact: true }).click()
    ])
    const headers = await billingResponse.request().allHeaders()

    async function read<T>(path: string, schema: z.ZodType<T>): Promise<T> {
      const response = await page.request.get(
        new URL(path, sandbox.PLAYWRIGHT_TEST_URL).href,
        { headers }
      )
      expect(response.status(), `GET ${path}`).toBe(200)
      return schema.parse(await response.json())
    }

    const workspace = await read(
      '/api/workspaces/current',
      zCurrentWorkspaceResponse
    )
    expect(workspace.type).toBe('personal')
    expect(workspace.role).toBe('owner')

    async function assertNoCardAccount() {
      const [status, methods] = await Promise.all([
        read('/api/billing/status', zBillingStatusResponse),
        read('/api/billing/payment-methods', zListSavedPaymentMethodsResponse)
      ])
      await testInfo.attach('billing-preflight.json', {
        body: JSON.stringify({
          workspaceId: workspace.id,
          isActive: status.is_active,
          billingStatus: status.billing_status,
          subscriptionTier: status.subscription_tier,
          planSlug: status.plan_slug,
          paymentMethodCount: methods.length
        }),
        contentType: 'application/json'
      })
      if (status.is_active) {
        expect(status.subscription_tier).toBe('FREE')
      } else {
        expect(['inactive', 'awaiting_payment_method']).toContain(
          status.billing_status
        )
      }
      expect(methods).toHaveLength(0)
    }

    await assertNoCardAccount()

    const [previewResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/api/billing/preview-subscribe'
      ),
      page.goto(`${sandbox.PLAYWRIGHT_TEST_URL}/?pricing=creator&cycle=monthly`)
    ])
    expect(previewResponse.status()).toBe(200)
    const preview = zPreviewSubscribeResponse.parse(
      await previewResponse.json()
    )
    expect(preview.allowed).toBe(true)
    expect(preview.new_plan.slug).toBe('creator-monthly')
    await testInfo.attach('sandbox.json', {
      body: JSON.stringify({
        baseURL: sandbox.PLAYWRIGHT_TEST_URL,
        workspaceId: workspace.id,
        frontendVersion:
          documentResponse?.headers()['x-frontend-version'] ?? null
      }),
      contentType: 'application/json'
    })
    await use({
      preview,
      readOperation: (operationId) =>
        read(
          `/api/billing/ops/${encodeURIComponent(operationId)}`,
          zBillingOpStatusResponse
        )
    })
  },
  comfyPage: async ({ page, request, billingSandbox }, use) => {
    expect(billingSandbox.preview.allowed).toBe(true)
    await use(new ComfyPage(page, request))
  }
})

export { comfyExpect } from '@e2e/fixtures/ComfyPage'
