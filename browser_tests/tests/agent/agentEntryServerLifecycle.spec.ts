import { expect, mergeTests } from '@playwright/test'

import { webSocketFixture } from '@e2e/fixtures/ws'
import { agentTest } from '@e2e/tests/agent/agentPanelMocks'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AgentServerFeature } from '@/workbench/extensions/agent/schemas/agentApiSchema'

const test = mergeTests(agentTest, webSocketFixture)

test.describe(
  "Agent entry button follows ComfyUI's agent",
  {
    tag: ['@agent', '@ui'],
    annotation: {
      type: 'issue',
      description:
        'https://github.com/Comfy-Org/ComfyUI_frontend/pull/20971: the panel mounts from the agent feature ComfyUI publishes, and unit tests only cover that with a mocked store'
    }
  },
  () => {
    test.use({
      agentFlagEnabled: false,
      connectWebSocketToServer: false,
      initialLocalStorage: { 'Comfy.AgentPanel.activationVisits': '2' }
    })

    test('stays inert while the agent starts or fails, then opens once it is ready', async ({
      page,
      agentPanel,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const publish = (type: string, data: unknown) =>
        ws.send(JSON.stringify({ type, data }))

      await test.step('a starting agent shows on the button, inert', async () => {
        const agent: AgentServerFeature = { state: 'starting', reason: null }
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
        const status: AgentServerFeature = {
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

      await test.step('a ready agent opens the panel', async () => {
        const status: AgentServerFeature = { state: 'ready', reason: null }
        publish('agent_status', status)
        await expect(agentPanel.openButton).not.toHaveAttribute(
          'aria-disabled',
          'true'
        )
        await expect(agentPanel.root).toHaveCount(0)
        await agentPanel.openButton.click()
        await expect(agentPanel.root).toBeVisible()
      })
    })
  }
)
