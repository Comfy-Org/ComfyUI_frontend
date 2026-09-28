import type { Page } from '@playwright/test'

import type { GlobalSetting, ListAssetsResponse } from '@comfyorg/ingest-types'

import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { AGENT_CONSENT_SETTING_ID } from '@/platform/settings/constants/agent'

import { cloudAppFixture, waitForCloudApp } from '@e2e/fixtures/cloudAppFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import {
  AGENT_COMPOSER_THREAD_ID,
  agentComposerRunMode,
  createAgentComposerConversation,
  createAgentComposerThreadList
} from '@e2e/fixtures/data/agent/agentComposerPerformance'
import { mockBilling } from '@e2e/fixtures/utils/cloudBillingMocks'
import { bootCloud, mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

function agentFeatures(agentFlag: boolean): RemoteConfig {
  return {
    'agent-in-app-experience': agentFlag,
    posthog_project_token: 'phc_e2e_agent_panel',
    posthog_config: { advanced_disable_flags: true }
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

type AgentComposerPerformanceFixtures = {
  agentComposerTurnCount: number
  agentComposerPanel: AgentPanel
}

export const agentComposerPerformanceTest =
  agentTest.extend<AgentComposerPerformanceFixtures>({
    agentComposerTurnCount: [0, { option: true }],
    agentComposerPanel: async (
      { page, agentFlagEnabled, agentComposerTurnCount },
      use
    ) => {
      const messages = createAgentComposerConversation(agentComposerTurnCount)
      const threads = createAgentComposerThreadList(messages)

      await page.route('**/api/experiment/models', (route) =>
        route.fulfill(jsonRoute([]))
      )
      await page.route('**/api/agent/threads', (route) =>
        route.fulfill(jsonRoute(threads))
      )
      await page.route('**/api/agent/run-mode', (route) =>
        route.fulfill(jsonRoute(agentComposerRunMode))
      )
      await page.route('**/api/agent/threads/*/messages', (route) => {
        if (route.request().method() !== 'GET') return route.fallback()
        return route.fulfill(jsonRoute(messages))
      })
      await page.addInitScript(
        ({ key, threadId }) => localStorage.setItem(key, threadId),
        {
          key: 'Comfy.Agent.ThreadId',
          threadId: AGENT_COMPOSER_THREAD_ID
        }
      )
      await bootAgentApp(page, agentFlagEnabled)

      const agentPanel = new AgentPanel(page)
      await agentPanel.open()
      await use(agentPanel)
    }
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
  await bootCloud(page)
  await page.goto(APP_URL)
  await waitForCloudApp(page)
}
