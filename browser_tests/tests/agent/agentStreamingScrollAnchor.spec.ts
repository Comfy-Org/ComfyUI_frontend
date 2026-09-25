import type { WebSocketRoute } from '@playwright/test'
import { expect, mergeTests } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { webSocketFixture } from '@e2e/fixtures/ws'
import {
  MESSAGE_DELTA_EVENT,
  agentTest
} from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

function pushDelta(socket: WebSocketRoute, delta: string): void {
  if (MESSAGE_DELTA_EVENT.type !== 'agent_message_delta')
    throw new Error('message delta fixture has the wrong event type')
  const event: AgentWsEvent = {
    type: 'agent_message_delta',
    data: { ...MESSAGE_DELTA_EVENT.data, delta }
  }
  socket.send(JSON.stringify(event))
}

// Matrix rank 81 / notion-11. Green regression guard: streaming follows a
// reply only while the reader remains at the bottom of the conversation.
test.describe(
  'Agent streaming scroll anchor',
  { tag: ['@cloud', '@ui'] },
  () => {
    test.use({ connectWebSocketToServer: false })

    test('keeps an earlier paragraph in view while more text streams', async ({
      agentPanel,
      getWebSocket,
      page,
      postedMessages
    }) => {
      await agentPanel.open()
      await agentPanel.selectWorkflow()

      const socket = await getWebSocket()
      await agentPanel.sendMessage('Explain this workflow in detail')
      await expect.poll(() => postedMessages).toHaveLength(1)
      await expect(
        agentPanel.root.getByTestId('user-message-bubble')
      ).toHaveText('Explain this workflow in detail')
      pushDelta(
        socket,
        Array.from(
          { length: 50 },
          (_, index) => `Paragraph ${index + 1}: workflow detail.\n\n`
        ).join('')
      )

      const streamedReply = agentPanel.root
        .getByTestId('markdown-stream')
        .last()
      await expect(streamedReply).toContainText(
        'Paragraph 50: workflow detail.'
      )
      const scrollContainer = streamedReply.locator(
        'xpath=ancestor::div[contains(@class, "overflow-y-auto")][1]'
      )
      await expect
        .poll(() =>
          scrollContainer.evaluate(
            (element) => element.scrollHeight > element.clientHeight
          )
        )
        .toBe(true)

      await scrollContainer.hover()
      await page.mouse.wheel(0, -10_000)
      const firstParagraph = streamedReply.getByText(
        'Paragraph 1: workflow detail.',
        { exact: true }
      )
      await expect(firstParagraph).toBeInViewport()
      await expect(
        agentPanel.root.getByRole('button', { name: enMessages.agent.latest })
      ).toBeVisible()

      pushDelta(
        socket,
        Array.from(
          { length: 25 },
          (_, index) => `New paragraph ${index + 1}: more streamed detail.\n\n`
        ).join('')
      )

      await expect(streamedReply).toContainText(
        'New paragraph 25: more streamed detail.'
      )
      await expect(firstParagraph).toBeInViewport()
      await expect(
        agentPanel.root.getByRole('button', { name: enMessages.agent.latest })
      ).toBeVisible()
    })
  }
)
