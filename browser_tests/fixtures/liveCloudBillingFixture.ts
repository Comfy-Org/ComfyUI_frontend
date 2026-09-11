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
import { withBillingCleanup } from '@e2e/fixtures/utils/liveCloudBillingCleanup'
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
    const documentResponse = await page.goto(
      `${sandbox.PLAYWRIGHT_TEST_URL}/cloud/login`
    )
    await page
      .getByRole('textbox', { name: 'Email', exact: true })
      .fill(sandbox.CLOUD_ACCOUNT_EMAIL)
    await page
      .getByLabel('Password', { exact: true })
      .fill(sandbox.CLOUD_ACCOUNT_PASSWORD)
    const [workspaceResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/api/workspaces/current'
      ),
      page.getByRole('button', { name: 'Sign in', exact: true }).click()
    ])
    expect(workspaceResponse.status()).toBe(200)
    const workspace = zCurrentWorkspaceResponse.parse(
      await workspaceResponse.json()
    )
    expect(workspace.type).toBe('personal')
    expect(workspace.role).toBe('owner')
    const headers = await workspaceResponse.request().allHeaders()

    async function read<T>(path: string, schema: z.ZodType<T>): Promise<T> {
      const response = await page.request.get(
        new URL(path, sandbox.PLAYWRIGHT_TEST_URL).href,
        { headers }
      )
      expect(response.status(), `GET ${path}`).toBe(200)
      return schema.parse(await response.json())
    }

    async function assertCleanWorkspace() {
      const [status, methods] = await Promise.all([
        read('/api/billing/status', zBillingStatusResponse),
        read('/api/billing/payment-methods', zListSavedPaymentMethodsResponse)
      ])
      expect(status.is_active).toBe(false)
      expect(status.billing_status).toBe('inactive')
      expect(methods).toHaveLength(0)
    }

    await assertCleanWorkspace()
    await withBillingCleanup(sandbox, workspace.id, async () => {
      const [previewResponse] = await Promise.all([
        page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname ===
            '/api/billing/preview-subscribe'
        ),
        page.goto(
          `${sandbox.PLAYWRIGHT_TEST_URL}/cloud/subscribe?tier=creator&cycle=monthly`
        )
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
    })
    await assertCleanWorkspace()
  },
  comfyPage: async ({ page, request, billingSandbox }, use) => {
    expect(billingSandbox.preview.allowed).toBe(true)
    await use(new ComfyPage(page, request))
  }
})

export { comfyExpect } from '@e2e/fixtures/ComfyPage'
