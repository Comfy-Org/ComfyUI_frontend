import type { Page } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

import { mockBilling } from '@e2e/fixtures/utils/cloudBillingMocks'
import { mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

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
  { agentFlag }: { agentFlag: boolean }
): Promise<void> {
  await mockCloudBoot(page, {
    features: agentFeatures(agentFlag),
    settings: {
      'Comfy.TutorialCompleted': true,
      'Comfy.RightSidePanel.ShowErrorsTab': false
    }
  })
  await mockBilling(page)
  await page.route('**/api/assets**', (r) =>
    r.fulfill(jsonRoute({ assets: [] }))
  )
}

type AgentFixtures = {
  agentFlagEnabled: boolean
}

export const agentTest = comfyPageFixture.extend<AgentFixtures>({
  agentFlagEnabled: [true, { option: true }],
  page: async ({ page, agentFlagEnabled }, use) => {
    await mockAgentBoot(page, { agentFlag: agentFlagEnabled })
    await use(page)
  }
})
