import type { Page } from '@playwright/test'
import type {
  BillingCapabilitiesResponse,
  BillingStatusResponse
} from '@comfyorg/ingest-types'

import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type {
  Member,
  WorkspaceWithRole
} from '@/platform/workspace/api/workspaceApi'

import { mockBilling } from '@e2e/fixtures/utils/cloudBillingMocks'
import { bootCloud, mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { mockWorkspace } from '@e2e/fixtures/utils/workspaceMocks'

export const APP_URL =
  process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

// The URL action loaders run at the tail of GraphCanvas onMounted, so the boot
// chain must not throw before them: a missing settings subpath, prompt
// exec_info, queue status, or an unmocked asset endpoint each abort that chain.
async function mockGraphBootExtras(page: Page) {
  // Boot only reads these; fall back on any write so an unexpected POST/PUT
  // surfaces instead of being masked by a blanket 200.
  await page.route('**/api/settings/**', (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill(jsonRoute({}))
  })
  // Cloud always has assets enabled, so the unmocked asset endpoints would 403
  // and workflow restore would throw uncaught. One glob covers every shape boot
  // asks for: `/api/assets`, `?query`, `/seed`, `/<id>`.
  await page.route('**/api/assets**', (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill(jsonRoute({ assets: [], total: 0, has_more: false }))
  })
  await page.route('**/api/prompt', (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill(jsonRoute({ exec_info: { queue_remaining: 0 } }))
  })
  await page.route('**/api/queue', (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill(jsonRoute({ queue_running: [], queue_pending: [] }))
  })
}

interface CloudAppSetupOptions {
  workspace: WorkspaceWithRole
  members?: Member[]
  /** Merged over the default boot features. */
  features?: RemoteConfig
  billingStatus?: BillingStatusResponse
  billingCapabilities?:
    | BillingCapabilitiesResponse
    | Promise<BillingCapabilitiesResponse>
  billingCapabilitiesStatus?: number
}

/**
 * Boot the cloud app on a raw `page` against fully mocked endpoints: core
 * boot routes, graph boot extras, billing, workspace membership, and
 * signed-in auth. Specs layer their own flow-specific routes on top.
 */
export async function setupCloudApp(
  page: Page,
  {
    workspace,
    members = [],
    features,
    billingStatus,
    billingCapabilities,
    billingCapabilitiesStatus
  }: CloudAppSetupOptions
) {
  await mockCloudBoot(page, { features: features ?? {} })
  await mockGraphBootExtras(page)
  await mockBilling(page, {
    workspaceId: workspace.id,
    billingStatus,
    billingCapabilities,
    billingCapabilitiesStatus
  })
  await mockWorkspace(page, workspace, members)
  await bootCloud(page)
}
