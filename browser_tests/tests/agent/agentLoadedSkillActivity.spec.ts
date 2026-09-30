import type { WebSocketRoute } from '@playwright/test'
import { expect, mergeTests } from '@playwright/test'

import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { webSocketFixture } from '@e2e/fixtures/ws'
import { agentTest } from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

function pushEvent(ws: WebSocketRoute, event: AgentWsEvent): void {
  ws.send(JSON.stringify(event))
}

// PM-1194 / https://github.com/Comfy-Org/ComfyUI_frontend/pull/18429
// The skill name arrives on a later running frame and may be absent from the
// completion frame. Exercise the production websocket-to-panel path so the
// visible activity trace cannot regress to the generic label at either seam.
test.describe('Loaded skill activity', { tag: ['@cloud', '@ui'] }, () => {
  test.use({ connectWebSocketToServer: false })

  test('keeps the visible skill name through completion', async ({
    acceptedTurns,
    agentPanel,
    getWebSocket
  }) => {
    await agentPanel.open()
    await agentPanel.selectWorkflow()

    const panel = agentPanel.root
    const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })
    await composer.fill('Use the comfy-director skill')
    await panel.getByRole('button', { name: 'Send' }).click()
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

    pushEvent(ws, event('running'))
    await expect(panel.getByText('Load skill', { exact: true })).toBeVisible()

    pushEvent(ws, event('running', 'comfy-director'))
    await expect(
      panel.getByText('Loading comfy-director', { exact: true })
    ).toBeVisible()

    pushEvent(ws, event('success'))
    await expect(
      panel.getByText('Loaded comfy-director', { exact: true })
    ).toBeVisible()
    await expect(panel.getByText('Load skill', { exact: true })).toHaveCount(0)
  })
})
