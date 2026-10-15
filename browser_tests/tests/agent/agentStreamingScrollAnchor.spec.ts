import type { WebSocketRoute } from '@playwright/test'
import { expect, mergeTests } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AgentTurnAccepted } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import type { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { webSocketFixture } from '@e2e/fixtures/ws'
import {
  MESSAGE_DONE_EVENT,
  TOOL_CALL_EVENT,
  agentTest,
  pushDelta,
  pushThinking,
  pushTurnEvent
} from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

async function finishWorkedTurnAfterLongReply({
  acceptedTurns,
  agentPanel,
  socket
}: {
  acceptedTurns: AgentTurnAccepted[]
  agentPanel: AgentPanel
  socket: WebSocketRoute
}): Promise<void> {
  const userMessages = agentPanel.root.getByTestId('user-message-bubble')
  await agentPanel.sendMessage('Explain this workflow in detail')
  await expect(userMessages).toHaveText(['Explain this workflow in detail'])
  pushDelta(
    socket,
    Array.from(
      { length: 40 },
      (_, index) => `Paragraph ${index + 1}: workflow detail.\n\n`
    ).join('')
  )
  socket.send(JSON.stringify(MESSAGE_DONE_EVENT))
  await expect(
    agentPanel.root.getByText('Paragraph 40: workflow detail.', {
      exact: true
    })
  ).toBeInViewport()

  await agentPanel.sendMessage('Plan this workflow')
  await expect(userMessages).toHaveText([
    'Explain this workflow in detail',
    'Plan this workflow'
  ])
  expect(acceptedTurns).toHaveLength(2)
  const planTurn = acceptedTurns[1].message_id
  pushThinking(
    socket,
    Array.from(
      { length: 3 },
      (_, index) => `Step ${index + 1}: check the graph.`
    ).join('\n\n'),
    planTurn
  )
  pushTurnEvent(socket, TOOL_CALL_EVENT, planTurn)
  pushDelta(socket, 'Done.', planTurn)
  pushTurnEvent(socket, MESSAGE_DONE_EVENT, planTurn)

  await expect(agentPanel.workSummary).toHaveAttribute('aria-expanded', 'false')
  await agentPanel.waitForConversationToSettle()
}

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

    test('keeps a completed Worked summary in place while its trace expands and collapses', async ({
      agentPanel,
      getWebSocket
    }) => {
      await agentPanel.open()
      await agentPanel.selectWorkflow()

      const socket = await getWebSocket()
      await agentPanel.sendMessage('Plan this workflow')
      await expect(
        agentPanel.root.getByTestId('user-message-bubble')
      ).toHaveText('Plan this workflow')
      pushThinking(
        socket,
        Array.from(
          { length: 80 },
          (_, index) => `Step ${index + 1}: check the graph.`
        ).join('\n\n')
      )
      socket.send(JSON.stringify(TOOL_CALL_EVENT))
      pushDelta(socket, 'Done.')
      socket.send(JSON.stringify(MESSAGE_DONE_EVENT))

      const summary = agentPanel.workSummary
      await expect(summary).toHaveAttribute('aria-expanded', 'false')
      const summaryTop = async () => (await summary.boundingBox())?.y ?? NaN
      await agentPanel.waitForConversationToSettle()
      await expect(agentPanel.latestButton).toBeHidden()
      const before = await summaryTop()

      await summary.click()
      await expect(
        agentPanel.root.getByText('Step 80: check the graph.')
      ).toBeAttached()
      await agentPanel.waitForConversationToSettle()

      await expect
        .poll(() =>
          agentPanel.conversationScroll.evaluate(
            (element) => element.scrollHeight > element.clientHeight
          )
        )
        .toBe(true)
      expect(await summaryTop()).toBeCloseTo(before, 0)
      await expect(agentPanel.latestButton).toBeVisible()

      await summary.click()
      await expect(summary).toHaveAttribute('aria-expanded', 'false')
      await agentPanel.waitForConversationToSettle()

      expect(await summaryTop()).toBeCloseTo(before, 0)
      await expect(agentPanel.latestButton).toBeHidden()
    })

    test('keeps a Worked summary in place when its trace expands at the bottom of a chat that scrolls', async ({
      acceptedTurns,
      agentPanel,
      getWebSocket
    }) => {
      await agentPanel.open()
      await agentPanel.selectWorkflow()

      const socket = await getWebSocket()
      await finishWorkedTurnAfterLongReply({
        acceptedTurns,
        agentPanel,
        socket
      })
      const summary = agentPanel.workSummary
      await expect(
        agentPanel.root.getByText('Done.', { exact: true })
      ).toBeInViewport()
      await expect(agentPanel.latestButton).toBeHidden()
      const summaryTop = async () => (await summary.boundingBox())?.y ?? NaN
      const before = await summaryTop()

      await summary.click()
      await expect(
        agentPanel.root.getByText('Step 3: check the graph.')
      ).toBeVisible()
      await agentPanel.waitForConversationToSettle()

      expect(await summaryTop()).toBeCloseTo(before, 0)
      await expect(agentPanel.latestButton).toBeVisible()

      await summary.click()
      await expect(summary).toHaveAttribute('aria-expanded', 'false')
      await agentPanel.waitForConversationToSettle()
      await expect(agentPanel.latestButton).toBeHidden()
    })

    test('follows a new reply after a trace collapses at the end of a long chat', async ({
      acceptedTurns,
      agentPanel,
      getWebSocket
    }) => {
      await agentPanel.open()
      await agentPanel.selectWorkflow()

      const socket = await getWebSocket()
      await finishWorkedTurnAfterLongReply({
        acceptedTurns,
        agentPanel,
        socket
      })
      const summary = agentPanel.workSummary
      await expect(summary).toBeInViewport()
      await expect(agentPanel.latestButton).toBeHidden()

      await summary.click()
      await expect(
        agentPanel.root.getByText('Step 3: check the graph.')
      ).toBeVisible()
      await agentPanel.waitForConversationToSettle()
      await expect(agentPanel.latestButton).toBeVisible()

      await summary.click()
      await expect(summary).toHaveAttribute('aria-expanded', 'false')
      await agentPanel.waitForConversationToSettle()
      await expect(agentPanel.latestButton).toBeHidden()

      const userMessages = agentPanel.root.getByTestId('user-message-bubble')
      await agentPanel.sendMessage('Explain the next step in detail')
      await expect(userMessages).toHaveText([
        'Explain this workflow in detail',
        'Plan this workflow',
        'Explain the next step in detail'
      ])
      expect(acceptedTurns).toHaveLength(3)
      pushDelta(
        socket,
        Array.from(
          { length: 50 },
          (_, index) => `Next step ${index + 1}: more detail.\n\n`
        ).join(''),
        acceptedTurns[2].message_id
      )

      await expect(
        agentPanel.root.getByText('Next step 50: more detail.', {
          exact: true
        })
      ).toBeInViewport()
      await expect(agentPanel.latestButton).toBeHidden()
    })

    test.describe('with room for an expanded trace', () => {
      test.use({ viewport: { width: 1280, height: 1000 } })

      test('follows a new reply once a fitting Worked trace finishes expanding', async ({
        acceptedTurns,
        agentPanel,
        getWebSocket
      }) => {
        await agentPanel.open()
        await agentPanel.selectWorkflow()

        const socket = await getWebSocket()
        const userMessages = agentPanel.root.getByTestId('user-message-bubble')
        await agentPanel.sendMessage('Plan this workflow')
        await expect(userMessages).toHaveText(['Plan this workflow'])
        pushThinking(
          socket,
          Array.from(
            { length: 3 },
            (_, index) => `Step ${index + 1}: check the graph.`
          ).join('\n\n')
        )
        socket.send(JSON.stringify(TOOL_CALL_EVENT))
        pushDelta(socket, 'Done.')
        socket.send(JSON.stringify(MESSAGE_DONE_EVENT))

        const summary = agentPanel.workSummary
        await expect(summary).toHaveAttribute('aria-expanded', 'false')
        await agentPanel.waitForConversationToSettle()

        await summary.click()
        await expect(
          agentPanel.root.getByText('Step 3: check the graph.')
        ).toBeVisible()
        await agentPanel.waitForConversationToSettle()
        await expect
          .poll(
            () =>
              agentPanel.conversationScroll.evaluate(
                (element) => element.scrollHeight > element.clientHeight
              ),
            { message: 'the expanded trace must still fit the panel' }
          )
          .toBe(false)

        await agentPanel.sendMessage('Explain this workflow in detail')
        await expect(userMessages).toHaveText([
          'Plan this workflow',
          'Explain this workflow in detail'
        ])
        expect(acceptedTurns).toHaveLength(2)
        pushDelta(
          socket,
          Array.from(
            { length: 50 },
            (_, index) => `Paragraph ${index + 1}: workflow detail.\n\n`
          ).join(''),
          acceptedTurns[1].message_id
        )

        await expect(
          agentPanel.root.getByText('Paragraph 50: workflow detail.', {
            exact: true
          })
        ).toBeInViewport()
        await expect(agentPanel.latestButton).toBeHidden()
      })
    })
  }
)
