import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { ListAssetsResponse } from '@comfyorg/ingest-types'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { RemoteConfig } from '@/platform/remoteConfig/types'

import { cloudAppFixture, waitForCloudApp } from '@e2e/fixtures/cloudAppFixture'
import { mockBilling } from '@e2e/fixtures/utils/cloudBillingMocks'
import { bootCloud, mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

function agentFeatures(agentFlag: boolean): RemoteConfig {
  return {
    posthog_project_token: 'phc_e2e_agent_panel',
    posthog_api_host: 'https://posthog.invalid',
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
  const emptyAssets: ListAssetsResponse = {
    assets: [],
    total: 0,
    has_more: false
  }
  await page.route('**/api/assets**', (r) => r.fulfill(jsonRoute(emptyAssets)))
  await page.route('https://posthog.invalid/**', (route) => {
    if (route.request().url().endsWith('.js')) {
      return route.fulfill({ contentType: 'text/javascript', body: '' })
    }
    return route.fulfill(jsonRoute({ status: 1 }))
  })
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
  agentFlag: boolean
): Promise<void> {
  // The shell's onboarding coach is a modal; pre-seed its dismissal so the
  // panel chrome is interactable, as the canonical agent suite does.
  await page.addInitScript(() => {
    localStorage.setItem('Comfy.AgentPanel.onboarded', 'true')
  })
  await mockAgentBoot(page, { agentFlag })
  await bootCloud(page)
  await page.goto(APP_URL)
  await waitForCloudApp(page)

  const panelTrigger = page.getByRole('button', {
    name: enMessages.agent.askComfyAgent
  })
  if (agentFlag) await expect(panelTrigger).toBeVisible()
  else await expect(panelTrigger).toHaveCount(0)
}
