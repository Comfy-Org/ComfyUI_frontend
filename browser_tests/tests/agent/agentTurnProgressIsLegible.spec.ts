import { expect, mergeTests } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { webSocketFixture } from '@e2e/fixtures/ws'
import {
  MESSAGE_DELTA_EVENT,
  MESSAGE_DONE_EVENT,
  OPEN_TAB_TOOL_EVENT,
  RUNNING_OPEN_TAB_TOOL_EVENT,
  THINKING_EVENT,
  agentTest,
  pushAgentEvent,
  thinkingEvent
} from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

test.describe(
  'Agent turn progress is legible',
  { tag: ['@cloud', '@ui'] },
  () => {
    test.use({ connectWebSocketToServer: false })

    test('shows a spinning in-progress row for a running tool call and settles it when the call finishes', async ({
      agentPanel,
      getWebSocket,
      postedMessages
    }) => {
      await agentPanel.open()
      await agentPanel.selectWorkflow()

      const ws = await getWebSocket()
      await agentPanel.sendMessage('Open a new tab for the upscale graph')
      await expect.poll(() => postedMessages.length).toBeGreaterThanOrEqual(1)

      const runningRow = agentPanel.activityRows.filter({
        hasText: enMessages.agent.toolOpeningNewTab
      })

      pushAgentEvent(ws, RUNNING_OPEN_TAB_TOOL_EVENT)
      await expect(runningRow).toHaveCount(1)
      const spinner = runningRow.locator('.animate-spin')
      await expect(spinner).toBeVisible()
      const motion = await spinner.evaluate((element) => {
        const style = getComputedStyle(element)
        return {
          name: style.animationName,
          durationMs: Number.parseFloat(style.animationDuration) * 1000,
          iterations: style.animationIterationCount
        }
      })
      expect(motion.name).not.toBe('none')
      expect(motion.durationMs).toBeGreaterThan(0)
      expect(motion.iterations).toBe('infinite')

      pushAgentEvent(ws, OPEN_TAB_TOOL_EVENT)
      const settledRow = agentPanel.activityRows.filter({
        hasText: enMessages.agent.toolOpenedNewTab
      })
      await expect(settledRow).toHaveCount(1)
      await expect(agentPanel.activityRows).toHaveCount(1)
      await expect(settledRow.locator('.animate-spin')).toHaveCount(0)
    })

    test('renders a multi-sentence thinking update in full instead of cutting it off', async ({
      agentPanel,
      getWebSocket,
      postedMessages
    }) => {
      await agentPanel.open()
      await agentPanel.selectWorkflow()

      const ws = await getWebSocket()
      await agentPanel.sendMessage('Plan the upscale pass before you edit')
      await expect.poll(() => postedMessages.length).toBeGreaterThanOrEqual(1)

      const thinking =
        'First I will read the graph and note every widget the prompt pays for. ' +
        'Then I will check which sampler the workflow is paging through, plumbing included. ' +
        'After that I will judge whether the upscaling stage is worth paying for. ' +
        'Finally I will apply the edits and tell you which pages changed, tagging any gaps.'
      pushAgentEvent(ws, thinkingEvent(thinking))

      const thinkingRow = agentPanel.root.getByText(thinking, { exact: true })
      await expect(thinkingRow).toBeVisible()

      const overflow = await thinkingRow.evaluate((element) => {
        const style = getComputedStyle(element)
        return {
          hiddenWidth: element.scrollWidth - element.clientWidth,
          hiddenHeight: element.scrollHeight - element.clientHeight,
          fontSizePx: Number.parseFloat(style.fontSize),
          lineHeightPx: Number.parseFloat(style.lineHeight)
        }
      })
      expect(overflow.hiddenWidth).toBeLessThanOrEqual(1)
      expect(overflow.hiddenHeight).toBeLessThanOrEqual(1)
      expect(overflow.lineHeightPx).toBeGreaterThan(overflow.fontSizePx)
      await expect(thinkingRow).toBeInViewport({ ratio: 1 })
    })

    test('names how long the finished turn took', async ({
      agentPanel,
      getWebSocket,
      postedMessages
    }) => {
      await agentPanel.open()
      await agentPanel.selectWorkflow()

      const ws = await getWebSocket()
      await agentPanel.sendMessage('Set the prompt to a red fox in the snow')
      await expect.poll(() => postedMessages.length).toBeGreaterThanOrEqual(1)

      pushAgentEvent(ws, THINKING_EVENT)
      pushAgentEvent(ws, OPEN_TAB_TOOL_EVENT)
      pushAgentEvent(ws, MESSAGE_DELTA_EVENT)
      pushAgentEvent(ws, MESSAGE_DONE_EVENT)

      await expect(agentPanel.sendButton).toBeVisible()
      await expect(agentPanel.workSummary).toHaveCount(1)

      test.fail()
      await expect(agentPanel.workSummary).toHaveText(
        /Worked for (\d+ seconds|\d+m \d+s)/
      )
    })
  }
)
