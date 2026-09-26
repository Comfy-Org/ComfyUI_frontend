import type { WebSocketRoute } from '@playwright/test'
import { expect, mergeTests } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { webSocketFixture } from '@e2e/fixtures/ws'
import {
  MESSAGE_DELTA_EVENT,
  MESSAGE_DONE_EVENT,
  OPEN_TAB_TOOL_EVENT,
  THINKING_EVENT,
  agentTest
} from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

function pushEvent(ws: WebSocketRoute, event: AgentWsEvent): void {
  ws.send(JSON.stringify(event))
}

// The same tool call `OPEN_TAB_TOOL_EVENT` reports, still in flight. The shared
// mock only carries the settled `success` shape, so no existing spec exercises
// the running state the spinner belongs to.
function runningToolCall(): AgentWsEvent {
  if (OPEN_TAB_TOOL_EVENT.type !== 'agent_tool_call')
    throw new Error('the new_tab tool fixture has the wrong event type')
  const { duration_ms: _settledDuration, ...data } = OPEN_TAB_TOOL_EVENT.data
  return { type: 'agent_tool_call', data: { ...data, status: 'running' } }
}

// Several sentences, each ending in a descender-heavy word, pushed as ONE
// thinking delta. The report is that the panel shows the opening clause and
// swallows the rest, so the assertion is on the whole text arriving — and on
// the element that holds it not being an overflow box that hides the tail.
const LONG_THINKING_SENTENCES = [
  'First I will read the graph and note every widget the prompt pays for.',
  'Then I will check which sampler the workflow is paging through, plumbing included.',
  'After that I will judge whether the upscaling stage is worth paying for.',
  'Finally I will apply the edits and tell you which pages changed, tagging any gaps.'
]

function longThinkingEvent(): AgentWsEvent {
  if (THINKING_EVENT.type !== 'agent_thinking')
    throw new Error('the thinking fixture has the wrong event type')
  return {
    type: 'agent_thinking',
    data: { ...THINKING_EVENT.data, delta: LONG_THINKING_SENTENCES.join(' ') }
  }
}

/**
 * Matrix rank 82 / slack-61 + regr-27 + regr-28 — "I cannot tell whether the
 * agent is working or finished". `qspec-3` automated the persistence legs and
 * returned this combined journey with no blocker named; `cover-1` re-opened it
 * (`reports/design/2026-09-26-matrix-coverage-audit.md`).
 *
 * Three observables, one per test, in the order the user meets them:
 *   1. a step that is still running says so, visibly and in motion
 *   2. thinking text arrives whole, not cut off mid-sentence
 *   3. a finished turn says how long it took
 *
 * (1) and (2) are green regression guards. (3) is a live-defect pin.
 */
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
      const panel = agentPanel.root
      await agentPanel.open()
      await agentPanel.selectWorkflow()

      const ws = await getWebSocket()
      await agentPanel.sendMessage('Open a new tab for the upscale graph')
      await expect.poll(() => postedMessages.length).toBeGreaterThanOrEqual(1)

      // Present tense plus a spinning glyph on the same row: the copy and the
      // motion are what tell the user this step has not finished yet.
      const runningRow = panel
        .getByRole('listitem')
        .filter({ hasText: enMessages.agent.toolOpeningNewTab })
      await expect(runningRow).toHaveCount(0)

      pushEvent(ws, runningToolCall())
      await expect(runningRow).toHaveCount(1)
      const spinner = runningRow.locator('.animate-spin')
      await expect(spinner).toBeVisible()
      // The class being present is not the same as the glyph moving: a dropped
      // keyframes rule, or a utility renamed out from under it, leaves the class
      // on screen and the motion gone. Read what the browser resolved.
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
      await expect(
        panel.getByText(enMessages.agent.toolOpenedNewTab, { exact: true })
      ).toHaveCount(0)

      // The same call reported done: the row keeps its place, drops the
      // motion, and switches to the past tense.
      pushEvent(ws, OPEN_TAB_TOOL_EVENT)
      const settledRow = panel
        .getByRole('listitem')
        .filter({ hasText: enMessages.agent.toolOpenedNewTab })
      await expect(settledRow).toHaveCount(1)
      await expect(panel.getByRole('listitem')).toHaveCount(1)
      await expect(runningRow).toHaveCount(0)
      await expect(settledRow.locator('.animate-spin')).toHaveCount(0)
    })

    test('renders a multi-sentence thinking update in full instead of cutting it off', async ({
      agentPanel,
      getWebSocket,
      postedMessages
    }) => {
      const panel = agentPanel.root
      await agentPanel.open()
      await agentPanel.selectWorkflow()

      const ws = await getWebSocket()
      await agentPanel.sendMessage('Plan the upscale pass before you edit')
      await expect.poll(() => postedMessages.length).toBeGreaterThanOrEqual(1)

      pushEvent(ws, longThinkingEvent())

      // Every sentence, last one included. A clamp that keeps the opening
      // clause and drops the tail satisfies neither the last sentence nor the
      // exact-text match on the whole delta.
      for (const sentence of LONG_THINKING_SENTENCES)
        await expect(panel.getByText(sentence, { exact: false })).toBeVisible()
      const thinkingRow = panel.getByText(LONG_THINKING_SENTENCES.join(' '), {
        exact: true
      })
      await expect(thinkingRow).toBeVisible()

      // The text wraps instead of being clipped: a one-line clamp or a fixed
      // height would leave the box scrollable, and either an ellipsis clamp or
      // a line-box too tight for descenders would cut the glyphs the last
      // sentence ends on.
      const overflow = await thinkingRow.evaluate((element) => {
        const style = getComputedStyle(element)
        return {
          hiddenHeight: element.scrollHeight - element.clientHeight,
          textOverflow: style.textOverflow,
          webkitLineClamp: style.webkitLineClamp,
          fontSizePx: Number.parseFloat(style.fontSize),
          lineHeightPx: Number.parseFloat(style.lineHeight)
        }
      })
      expect(overflow.hiddenHeight).toBeLessThanOrEqual(1)
      expect(overflow.textOverflow).toBe('clip')
      expect(overflow.webkitLineClamp).toBe('none')
      expect(overflow.lineHeightPx).toBeGreaterThan(overflow.fontSizePx)

      // The metrics above only see clipping by the row's OWN box. The
      // conversation is an `overflow-y-auto` scrollport inside a panel that is
      // `overflow-hidden`, so a row cut off by either ancestor would satisfy
      // every assertion so far. `toBeInViewport` measures the intersection
      // after ancestor clipping, and `ratio: 1` is the whole row being on
      // screen — the only form of "not cut off" the user cares about.
      await expect(thinkingRow).toBeInViewport({ ratio: 1 })
    })

    // LIVE-DEFECT PIN — expected to fail on `main`.
    //
    // `agent.workedForSeconds` ("Worked for {seconds} seconds") and
    // `agent.workedForMinutes` ("Worked for {minutes}m {seconds}s") are both in
    // `src/locales/en/main.json` and neither is referenced anywhere in `src/`:
    // `WorkSummary.vue` renders the bare `agent.worked` and nothing else. So the
    // elapsed time the story asks for is an intended string that was never
    // wired up, not a deliberate omission.
    //
    // This is turn-level elapsed time, NOT the per-tool-call durations that
    // `agentPanel.spec.ts` asserts are absent (`'0.5s'`, `'0.2s'`) — those are
    // a separate, deliberately hidden surface. This pin does not contradict it.
    test.fail(
      'names how long the finished turn took',
      async ({ agentPanel, getWebSocket, postedMessages }) => {
        const panel = agentPanel.root
        await agentPanel.open()
        await agentPanel.selectWorkflow()

        const ws = await getWebSocket()
        await agentPanel.sendMessage('Set the prompt to a red fox in the snow')
        await expect.poll(() => postedMessages.length).toBeGreaterThanOrEqual(1)

        pushEvent(ws, THINKING_EVENT)
        pushEvent(ws, OPEN_TAB_TOOL_EVENT)
        pushEvent(ws, MESSAGE_DELTA_EVENT)
        pushEvent(ws, MESSAGE_DONE_EVENT)

        // The turn is over: Send is back and the collapsed summary is up.
        await expect(
          panel.getByRole('button', { name: enMessages.agent.send })
        ).toBeVisible()
        const summary = panel.getByRole('button', {
          name: new RegExp(`^${enMessages.agent.worked}`)
        })
        await expect(summary).toHaveCount(1)

        // "Worked" alone does not answer "how long was it working?".
        await expect(summary).toHaveText(/Worked for .+/)
      }
    )
  }
)
