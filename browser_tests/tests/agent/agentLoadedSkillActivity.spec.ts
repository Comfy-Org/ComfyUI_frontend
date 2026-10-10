import { expect, mergeTests } from '@playwright/test'

import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { webSocketFixture } from '@e2e/fixtures/ws'
import { agentTest, pushAgentEvent } from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

test.describe('Loaded skill activity', { tag: ['@cloud', '@ui'] }, () => {
  test.use({ connectWebSocketToServer: false })

  test('keeps the visible skill name through completion', async ({
    acceptedTurns,
    agentPanel,
    getWebSocket
  }) => {
    await agentPanel.open()
    await agentPanel.selectWorkflow()
    await agentPanel.sendMessage('Use the comfy-director skill')
    await expect.poll(() => acceptedTurns).toHaveLength(1)

    const ws = await getWebSocket()
    const event = (status: 'running' | 'success', skill?: string) =>
      ({
        type: 'agent_tool_call',
        data: {
          tool_call_id: 'call-load-skill',
          tool_name: 'load_skill',
          status,
          ...(skill === undefined ? {} : { skill }),
          message_id: acceptedTurns[0].message_id,
          thread_id: acceptedTurns[0].thread_id
        }
      }) satisfies AgentWsEvent

    await test.step('shows the generic label before the skill is named', async () => {
      pushAgentEvent(ws, event('running'))
      await expect(agentPanel.activityRow('Load skill')).toBeVisible()
    })

    await test.step('names the skill while it loads', async () => {
      pushAgentEvent(ws, event('running', 'comfy-director'))
      await expect(
        agentPanel.activityRow('Loading comfy-director')
      ).toBeVisible()
    })

    await test.step('keeps the name after an unnamed completion', async () => {
      pushAgentEvent(ws, event('success'))
      await expect(
        agentPanel.activityRow('Loaded comfy-director')
      ).toBeVisible()
      await expect(agentPanel.activityRow('Load skill')).toHaveCount(0)
    })
  })
})
