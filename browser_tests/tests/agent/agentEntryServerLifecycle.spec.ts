import { expect, mergeTests } from '@playwright/test'

import type { ListMembersResponse } from '@comfyorg/ingest-types'

import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { webSocketFixture } from '@e2e/fixtures/ws'
import { agentTest } from '@e2e/tests/agent/agentPanelMocks'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { ComfyAgentFeature } from '@/platform/remoteConfig/comfyAgentFeature'

const test = mergeTests(agentTest, webSocketFixture).extend({
  page: async ({ page }, use) => {
    await page.route('**/api/workspace/members**', (route) =>
      route.fulfill(
        jsonRoute({
          members: [],
          pagination: { offset: 0, limit: 50, total: 0, has_more: false }
        } satisfies ListMembersResponse)
      )
    )
    await use(page)
  }
})

test.describe(
  "Agent entry button follows ComfyUI's agent",
  {
    tag: ['@agent', '@ui'],
    annotation: {
      type: 'issue',
      description:
        'https://github.com/Comfy-Org/ComfyUI_frontend/pull/20971: the entry button follows the agent feature ComfyUI publishes and mounts the panel once ready, and unit tests only cover that with a mocked store'
    }
  },
  () => {
    test.use({
      agentFlagEnabled: false,
      connectWebSocketToServer: false,
      initialLocalStorage: {
        'Comfy.AgentPanel.activationVisits': '2',
        'Comfy.AgentConsent.IntroductionResponded.test-user-e2e.ws-personal':
          'true',
        'Comfy.AgentPanel.onboarded.test-user-e2e.ws-personal': 'true'
      }
    })

    test('stays inert while the agent starts or fails, then offers it once it is ready', async ({
      page,
      agentPanel,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const publish = (type: string, data: unknown) =>
        ws.send(JSON.stringify({ type, data }))

      await test.step('a starting agent shows on the button, inert', async () => {
        const agent: ComfyAgentFeature = { state: 'starting' }
        publish('feature_flags', { agent })
        const starting = page.getByRole('button', {
          name: enMessages.agent.entryStarting,
          exact: true
        })
        await expect(starting).toHaveAttribute('aria-disabled', 'true')
        await expect(agentPanel.openButton).toHaveCount(0)
        await starting.press('Enter')
        await expect(starting).toHaveAttribute('aria-pressed', 'false')
      })

      await test.step('a failed agent names its reason, inert', async () => {
        const status: ComfyAgentFeature = {
          state: 'failed',
          reason: 'not_found'
        }
        publish('agent_status', status)
        const failed = page.getByRole('button', {
          name: enMessages.agent.entryFailed,
          exact: true
        })
        await expect(failed).toHaveAttribute('aria-disabled', 'true')
        await expect(failed).toHaveAttribute(
          'title',
          enMessages.agent.entryFailedReason.replace('{reason}', 'not_found')
        )
        await failed.press('Enter')
        await expect(failed).toHaveAttribute('aria-pressed', 'false')
      })

      await test.step('a ready agent offers itself to a signed-out user', async () => {
        const status: ComfyAgentFeature = { state: 'ready' }
        publish('agent_status', status)
        await expect(agentPanel.openButton).not.toHaveAttribute(
          'aria-disabled',
          'true'
        )
        await expect(agentPanel.consentDialog).toHaveCount(0)
        await agentPanel.openButton.click()
        await expect(agentPanel.consentDialog).toBeVisible()
        await expect(
          agentPanel.consentDialog.getByRole('button', {
            name: enMessages.agent.consent.agreeAndContinue,
            exact: true
          })
        ).toBeVisible()
        await expect(agentPanel.root).toHaveCount(0)
      })
    })

    test(
      'opens the panel for a signed-in user who already agreed, once the agent is ready',
      { tag: '@auth' },
      async ({ page, agentPanel, getWebSocket }) => {
        const ws = await getWebSocket()
        const publish = (type: string, data: unknown) =>
          ws.send(JSON.stringify({ type, data }))

        const starting: ComfyAgentFeature = { state: 'starting' }
        publish('feature_flags', { agent: starting })
        await expect(
          page.getByRole('button', {
            name: enMessages.agent.entryStarting,
            exact: true
          })
        ).toHaveAttribute('aria-disabled', 'true')
        await expect(agentPanel.root).toHaveCount(0)

        const ready: ComfyAgentFeature = { state: 'ready' }
        publish('agent_status', ready)
        await expect(agentPanel.openButton).not.toHaveAttribute(
          'aria-disabled',
          'true'
        )
        await agentPanel.openButton.click()
        await expect(agentPanel.root).toBeVisible()
        await expect(agentPanel.consentDialog).toHaveCount(0)
      }
    )
  }
)
