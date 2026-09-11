import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import {
  zBillingOpStatusResponse,
  zBillingStatusResponse,
  zCurrentWorkspaceResponse,
  zListSavedPaymentMethodsResponse,
  zPreviewSubscribeResponse
} from '@comfyorg/ingest-types/zod'
import { z } from 'zod'

import {
  ComfyPage,
  comfyExpect as expect,
  comfyPageFixture as base
} from '@e2e/fixtures/ComfyPage'
import { loadLiveCloudBillingConfig } from '@e2e/fixtures/utils/liveCloudBillingConfig'

const execFileAsync = promisify(execFile)
const sandbox = loadLiveCloudBillingConfig()
const resetResultSchema = z.object({
  workspace_id: z.literal(sandbox.workspaceId),
  stripe_livemode: z.literal(false),
  pending_operations: z.literal(0)
})

async function resetSandbox() {
  let stdout: string
  try {
    const result = await execFileAsync(
      sandbox.resetScript,
      [sandbox.baseURL, sandbox.workspaceId],
      { timeout: 60_000, maxBuffer: 16_384 }
    )
    stdout = result.stdout
  } catch {
    throw new Error('Sandbox billing reset failed; do not reuse this workspace')
  }
  resetResultSchema.parse(JSON.parse(stdout))
}

interface BillingSandbox {
  preview: z.infer<typeof zPreviewSubscribeResponse>
  readOperation: (
    operationId: string
  ) => Promise<z.infer<typeof zBillingOpStatusResponse>>
}

export const liveCloudBillingFixture = base.extend<{
  billingSandbox: BillingSandbox
}>({
  networkPolicy: async ({ baseURL }, use) => {
    expect(baseURL).toBe(sandbox.baseURL)
    const origins = new Set([sandbox.baseURL, ...sandbox.allowedOrigins])
    const unexpected = new Set<string>()
    await use({ origins, unexpected })
    expect(
      [...unexpected],
      'Add the required sandbox dependency origin'
    ).toEqual([])
  },
  billingSandbox: async ({ page }, use, testInfo) => {
    let verifyCleanup: (() => Promise<void>) | undefined
    try {
      await resetSandbox()
      const [workspaceResponse, documentResponse] = await Promise.all([
        page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === '/api/workspaces/current'
        ),
        page.goto(sandbox.baseURL)
      ])
      expect(workspaceResponse.status()).toBe(200)
      const workspace = zCurrentWorkspaceResponse.parse(
        await workspaceResponse.json()
      )
      expect(workspace.id).toBe(sandbox.workspaceId)
      expect(workspace.type).toBe('personal')
      expect(workspace.role).toBe('owner')
      const headers = await workspaceResponse.request().allHeaders()

      async function read<T>(path: string, schema: z.ZodType<T>): Promise<T> {
        const response = await page.request.get(
          new URL(path, sandbox.baseURL).href,
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

      verifyCleanup = assertCleanWorkspace
      await assertCleanWorkspace()
      const [previewResponse] = await Promise.all([
        page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname ===
            '/api/billing/preview-subscribe'
        ),
        page.goto(
          `${sandbox.baseURL}/cloud/subscribe?tier=creator&cycle=monthly`
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
          baseURL: sandbox.baseURL,
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
    } finally {
      await resetSandbox()
      await verifyCleanup?.()
    }
  },
  comfyPage: async ({ page, request, billingSandbox }, use) => {
    expect(billingSandbox.preview.allowed).toBe(true)
    await use(new ComfyPage(page, request))
  }
})

export { comfyExpect } from '@e2e/fixtures/ComfyPage'
