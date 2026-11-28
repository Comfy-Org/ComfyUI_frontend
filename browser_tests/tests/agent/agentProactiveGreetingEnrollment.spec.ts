import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { RemoteConfig } from '@/platform/remoteConfig/types'

import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { agentTest as base } from '@e2e/tests/agent/agentPanelMocks'

const proactiveFeatures = {
  enable_telemetry: true,
  agent_proactive_greeting_assignment: {
    user_id: 'test-user-e2e',
    workspace_id: 'ws-personal',
    group_key: '["test-user-e2e","ws-personal"]',
    variant: 'generic'
  }
} satisfies RemoteConfig

const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('**/api/agent/usage-status', (route) =>
      route.fulfill(jsonRoute({ has_used_agent: false }))
    )
    await page.addInitScript(() => {
      const listeners = new Set<() => void>()
      Object.assign(window, {
        __comfyDesktop2: {
          isRemote: () => true,
          Telemetry: {
            capture: () => undefined,
            proactiveGreetingExperimentVersion: 2,
            getProactiveGreetingAdmission: async () => 'allowed',
            enrollProactiveGreeting: async () => true,
            onProactiveGreetingAdmissionChanged: (listener: () => void) => {
              listeners.add(listener)
              return () => listeners.delete(listener)
            }
          }
        }
      })
    })
    await use(page)
  }
})

test.describe(
  'Desktop-hosted Cloud proactive Agent greeting',
  {
    tag: ['@cloud', '@agent', '@ui'],
    annotation: {
      type: 'source',
      description: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/23097'
    }
  },
  () => {
    test.use({
      agentConsentWebSession: true,
      agentRemoteConfig: proactiveFeatures
    })

    test('shows the admitted greeting and retires it after the first accepted send', async ({
      agentPanel
    }) => {
      const proactiveHeading = agentPanel.root.getByRole('heading', {
        name: enMessages.agent.proactiveGreeting.firstOpen.title,
        exact: true
      })

      await agentPanel.open()
      await expect(proactiveHeading).toBeVisible()
      await expect(agentPanel.composer).toHaveText(
        enMessages.agent.proactiveGreeting.firstOpen.prompt
      )

      await agentPanel.sendButton.click()

      await expect(proactiveHeading).toHaveCount(0)
      await agentPanel.expectUserMessages([
        enMessages.agent.proactiveGreeting.firstOpen.prompt
      ])
    })
  }
)
