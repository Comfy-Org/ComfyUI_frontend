import type { Page } from '@playwright/test'

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

// consolidated_billing_enabled routes personal workspaces to the unified
// billing surfaces the cloud specs assert; without it they fall back to the
// legacy variants.
const DEFAULT_FEATURES = {
  team_workspaces_enabled: true,
  consolidated_billing_enabled: true
} satisfies RemoteConfig

// Disable the experimental Asset API: with it on (cloud default) the unmocked
// asset endpoints 403 and workflow restore throws uncaught, aborting the
// GraphCanvas onMounted chain before the URL action loaders.
const DEFAULT_SETTINGS = { 'Comfy.Assets.UseAssetAPI': false }

// The URL action loaders run at the tail of GraphCanvas onMounted, so the boot
// chain must not throw before them: a missing settings subpath, prompt
// exec_info, or queue status each abort that chain.
async function mockGraphBootExtras(page: Page) {
  // Boot only reads these; fall back on any write so an unexpected POST/PUT
  // surfaces instead of being masked by a blanket 200.
  await page.route('**/api/settings/**', (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill(jsonRoute({}))
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
}

/**
 * Boot the cloud app on a raw `page` against fully mocked endpoints: core
 * boot routes, graph boot extras, billing, workspace membership, and
 * signed-in auth. Specs layer their own flow-specific routes on top.
 */
export async function setupCloudApp(
  page: Page,
  { workspace, members = [], features }: CloudAppSetupOptions
) {
  await mockCloudBoot(page, {
    features: { ...DEFAULT_FEATURES, ...features },
    settings: DEFAULT_SETTINGS
  })
  await mockGraphBootExtras(page)
  await mockBilling(page)
  await mockWorkspace(page, workspace, members)
  await bootCloud(page)
}
