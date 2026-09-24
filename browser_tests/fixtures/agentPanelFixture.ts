import type { Page, Route } from '@playwright/test'

import type {
  AgentRunMode,
  AgentThreadListResponse,
  GlobalSetting,
  ListAssetsResponse,
  WorkflowListResponse
} from '@comfyorg/ingest-types'

import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type { UserDataFullInfo } from '@/platform/remote/comfyui/types'
import { AGENT_CONSENT_SETTING_ID } from '@/platform/settings/constants/agent'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import type { AgentTurnAccepted } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { mockAgentIdentity } from '@e2e/fixtures/agentSocket'
import { cloudAppFixture, waitForCloudApp } from '@e2e/fixtures/cloudAppFixture'
import { mockBilling } from '@e2e/fixtures/utils/cloudBillingMocks'
import { bootCloud, mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

function agentFeatures(agentFlag: boolean): RemoteConfig {
  return {
    posthog_project_token: 'phc_e2e_agent_panel',
    posthog_config: {
      advanced_disable_flags: true,
      bootstrap: {
        featureFlags: { 'agent-in-app-experience': agentFlag }
      }
    }
  }
}

interface BootAgentAppOptions {
  /** Extra `/api/settings` entries layered over the panel defaults. */
  settings?: Record<string, unknown>
  /** Server definitions, optionally augmented with deterministic test entries. */
  objectInfo?: 'server' | Record<string, ComfyNodeDef>
  /** Preserve existing tests by default; onboarding specs opt into the tour. */
  onboardingCompleted?: boolean
  /**
   * Assets the Media Assets panel serves. Defaults to empty, which is what
   * every panel spec that does not care about assets expects; specs covering
   * asset-to-composer flows seed it instead of re-routing `/api/assets` after
   * boot and relying on route-precedence order.
   */
  assets?: ListAssetsResponse
  beforeNavigate?: (page: Page) => Promise<void>
}

async function mockAgentBoot(
  page: Page,
  {
    agentFlag,
    settings,
    objectInfo,
    assets
  }: { agentFlag: boolean } & BootAgentAppOptions
): Promise<void> {
  await mockCloudBoot(page, {
    features: agentFeatures(agentFlag),
    settings: {
      'Comfy.TutorialCompleted': true,
      'Comfy.RightSidePanel.ShowErrorsTab': false,
      ...settings
    },
    objectInfo
  })
  await mockBilling(page)
  // The canvas follower stays inactive until the agent names its user.
  await mockAgentIdentity(page)
  const storedConsent: GlobalSetting = {
    key: AGENT_CONSENT_SETTING_ID,
    value: true,
    updated_at: '2026-09-09T00:00:00Z'
  }
  await page.route(
    `**/api/global-settings/${AGENT_CONSENT_SETTING_ID}`,
    (route) => route.fulfill(jsonRoute(storedConsent))
  )
  const listedAssets: ListAssetsResponse = assets ?? {
    assets: [],
    total: 0,
    has_more: false
  }
  // Scoped to the list endpoint so a spec can still route `/api/assets/<id>/content`
  // for the file itself; `**/api/assets**` would otherwise swallow it.
  await page.route('**/api/assets?**', (r) =>
    r.fulfill(jsonRoute(listedAssets))
  )
  await page.route('**/api/assets', (r) => r.fulfill(jsonRoute(listedAssets)))
  // The bootstrapped project token makes PostHogTelemetryProvider run a real
  // posthog.init(); route its ingest host so CI never emits live third-party
  // traffic under the fabricated token.
  await page.route('**://t.comfy.org/**', (r) =>
    r.fulfill(jsonRoute({ status: 1 }))
  )
}

export async function mockAgentTurnApi(
  page: Page,
  turnAccepted: AgentTurnAccepted
): Promise<void> {
  const threads: AgentThreadListResponse = {
    threads: [],
    pagination: { has_more: false, limit: 100, offset: 0, total: 0 }
  }
  const runMode: AgentRunMode = { mode: 'ask_approval', credit_limit: null }
  await page.route('**/api/experiment/models', (route) =>
    route.fulfill(jsonRoute([]))
  )
  await page.route('**/api/agent/threads', (route) =>
    route.fulfill(jsonRoute(threads))
  )
  await page.route('**/api/agent/run-mode', (route) =>
    route.fulfill(jsonRoute(runMode))
  )
  await page.route('**/api/agent/threads/*/messages', (route) =>
    route.fulfill(jsonRoute(turnAccepted))
  )
}

export async function mockWorkflowPersistence(
  page: Page,
  workflowId: string
): Promise<void> {
  let savedName: string | undefined
  await page.route('**/api/userdata/*', (route) => {
    const request = route.request()
    const path = decodeURIComponent(
      new URL(request.url()).pathname.split('/userdata/')[1]
    )
    if (request.method() !== 'POST' || !path.startsWith('workflows/'))
      return route.fallback()
    savedName = path.slice('workflows/'.length, -'.json'.length)
    const saved: UserDataFullInfo = {
      path,
      modified: Date.now(),
      size: request.postDataBuffer()?.length ?? 0
    }
    return route.fulfill(jsonRoute(saved))
  })
  const fulfillWorkflowList = (route: Route) => {
    const workflows: WorkflowListResponse = {
      data:
        savedName === undefined
          ? []
          : [
              {
                id: workflowId,
                name: savedName,
                created_at: '2026-09-01T00:00:00Z',
                updated_at: '2026-09-01T00:00:00Z',
                created_by: 'test-user-e2e',
                latest_version: 1
              }
            ],
      pagination: {
        has_more: false,
        limit: 100,
        offset: 0,
        total: savedName === undefined ? 0 : 1
      }
    }
    return route.fulfill(jsonRoute(workflows))
  }
  await page.route('**/api/workflows?*', fulfillWorkflowList)
  await page.route('**/api/workflows', fulfillWorkflowList)
}

type AgentFixtures = {
  agentFlagEnabled: boolean
}

/**
 * Drives a raw `page` against fully-mocked endpoints, like the cloud
 * siblings (`comfyPage` would reach the OSS devtools backend during setup
 * and its request-context settings seed bypasses page routes): boot mocks,
 * signed-in `bootCloud`, navigate, wait for the app.
 */
export const agentTest = cloudAppFixture.extend<AgentFixtures>({
  agentFlagEnabled: [true, { option: true }]
})

export async function bootAgentApp(
  page: Page,
  agentFlag: boolean,
  options: BootAgentAppOptions = {}
): Promise<void> {
  const { onboardingCompleted = true } = options
  await page.addInitScript((completed) => {
    if (localStorage.getItem('Comfy.AgentPanel.onboarded') === null) {
      localStorage.setItem('Comfy.AgentPanel.onboarded', String(completed))
    }
  }, onboardingCompleted)
  await mockAgentBoot(page, { agentFlag, ...options })
  await options.beforeNavigate?.(page)
  await bootCloud(page)
  await page.goto(APP_URL)
  await waitForCloudApp(page)
}
