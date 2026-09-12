import type { Page } from '@playwright/test'

import type { ListAssetsResponse } from '@comfyorg/ingest-types'

import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import type { AgentTurnAccepted } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { cloudAppFixture, waitForCloudApp } from '@e2e/fixtures/cloudAppFixture'
import { mockBilling } from '@e2e/fixtures/utils/cloudBillingMocks'
import { bootCloud, mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

interface BootAgentAppOptions {
  nodeDefs?: Record<string, ComfyNodeDef>
  turnAccepted?: AgentTurnAccepted
}

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

async function mockAgentBoot(
  page: Page,
  {
    agentFlag,
    nodeDefs,
    turnAccepted
  }: { agentFlag: boolean } & BootAgentAppOptions
): Promise<void> {
  await mockCloudBoot(page, {
    features: agentFeatures(agentFlag),
    settings: {
      'Comfy.TutorialCompleted': true,
      'Comfy.RightSidePanel.ShowErrorsTab': false
    }
  })
  await mockBilling(page)
  const emptyAssets: ListAssetsResponse = {
    assets: [],
    total: 0,
    has_more: false
  }
  await page.route('**/api/assets**', (r) => r.fulfill(jsonRoute(emptyAssets)))
  if (nodeDefs) {
    await page.route('**/api/object_info', (r) =>
      r.fulfill(jsonRoute(nodeDefs))
    )
  }
  if (turnAccepted) {
    await page.route('**/api/experiment/models', (r) =>
      r.fulfill(jsonRoute([]))
    )
    await page.route('**/api/agent/threads', (r) =>
      r.fulfill(jsonRoute({ threads: [] }))
    )
    await page.route('**/api/agent/run-mode', (r) =>
      r.fulfill(jsonRoute({ mode: 'manual', credit_limit: null }))
    )
    await page.route('**/api/workflows**', (r) =>
      r.fulfill(
        jsonRoute({
          data: [],
          pagination: { has_more: false, next_cursor: null }
        })
      )
    )
    await page.route('**/api/agent/threads/*/messages', (r) =>
      r.fulfill(jsonRoute(turnAccepted))
    )
  }
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

export async function bootAgentApp(
  page: Page,
  agentFlag: boolean,
  options: BootAgentAppOptions = {}
): Promise<void> {
  // The shell's onboarding coach is a modal; pre-seed its dismissal so the
  // panel chrome is interactable, as the canonical agent suite does.
  await page.addInitScript(() => {
    localStorage.setItem('Comfy.AgentPanel.onboarded', 'true')
  })
  await mockAgentBoot(page, { agentFlag, ...options })
  await bootCloud(page)
  await page.goto(APP_URL)
  await waitForCloudApp(page)
}
