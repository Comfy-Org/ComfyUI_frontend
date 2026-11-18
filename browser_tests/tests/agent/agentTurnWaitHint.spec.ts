import { expect, mergeTests } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AgentTurnAccepted } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { Topbar } from '@e2e/fixtures/components/Topbar'
import { webSocketFixture } from '@e2e/fixtures/ws'
import {
  agentTest as baseAgentTest,
  pushAgentEvent
} from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(baseAgentTest, webSocketFixture)

test.describe('Agent turn wait hint', { tag: ['@cloud', '@ui'] }, () => {
  test.use({ connectWebSocketToServer: false })

  test('C8-01 + C8-04: shows the slot-wait hint under Thinking... and clears it once a reply delta arrives', async ({
    agentPanel,
    getAgentSocket,
    page
  }) => {
    await new Topbar(page).saveWorkflowAs('Unsaved Workflow')
    await agentPanel.open()

    const acceptedResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes('/api/agent/threads/') &&
        response.url().endsWith('/messages')
    )
    await agentPanel.sendMessage('Wait for a free slot')
    const ack = (await (await acceptedResponse).json()) as AgentTurnAccepted

    const ws = await getAgentSocket()
    pushAgentEvent(ws, {
      type: 'agent_turn_status',
      data: {
        phase: 'wait',
        reason: 'turn_user_full',
        position: 0,
        wait_seconds: 0,
        thread_id: ack.thread_id,
        message_id: ack.message_id
      }
    })

    const waitHint = agentPanel.root.getByTestId('agent-turn-wait-hint')
    await expect(
      agentPanel.root.getByText(enMessages.agent.thinking)
    ).toBeVisible()
    await expect(waitHint).toHaveText(enMessages.agent.turnWaitUserFull)

    pushAgentEvent(ws, {
      type: 'agent_message_delta',
      data: {
        delta: 'Starting reply now.',
        thread_id: ack.thread_id,
        message_id: ack.message_id
      }
    })

    await expect(waitHint).toHaveCount(0)
    await expect(agentPanel.root.getByText('Starting reply now.')).toBeVisible()
  })
})
