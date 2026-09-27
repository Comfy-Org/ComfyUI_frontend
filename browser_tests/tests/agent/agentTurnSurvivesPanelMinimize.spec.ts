import { expect } from '@playwright/test'

import {
  POST_RECONNECT_EVENT,
  POST_RECONNECT_TEXT,
  TURN_DONE_EVENT,
  TURN_IN_PROGRESS_MESSAGE,
  agentTurnLockTest as test
} from '@e2e/fixtures/agentTurnLockFixture'

// PM-1776 / PM-1682. Reported on 1.54.15: the reporter asked the agent to build
// a workflow, minimized the panel with the topbar Agent button before it
// finished, and reopened it. The chat looked completed — no working indicator —
// while nodes kept appearing on the canvas, and the next message came back
// "Message failed to send: a turn is already in progress for this thread".
//
// `DockedAgentPanel.vue` gates the dock on `v-if`, so minimizing unmounts
// `AgentPanelRoot` and runs its `onBeforeUnmount` -> `useAgentSession.stop()`.
// That queues `abortActiveTurn()` + `dropBackgroundTurns()` behind a generation
// guard which only spares a turn when a remount bumps `sessionGeneration`
// first. A minimize never remounts, so the guard passes and the live turn is
// destroyed locally. Nothing is sent to the server, which keeps streaming and
// keeps answering posts with 409.
//
// Reopening remounts and hydrates from REST, but `applyAssistantRow` in
// `agentTranscript.ts` only returns a `pending` entry when the streaming row
// also carries a `pending_ask`; a plain mid-build row yields
// `message.streaming = false`, so hydrate restores no active turn and the
// indicator never comes back.
//
// Deliberately neither a refresh nor a socket drop: PM-1043 and PM-1199 cover
// those triggers. Here the page is never reloaded and the socket never closes —
// only the panel's own mount state changes.
test.describe.configure({ timeout: 120_000 })
test.use({ connectWebSocketToServer: false })

test.describe(
  'Agent turn across an agent-panel minimize and restore',
  { tag: ['@cloud', '@agent', '@ui'] },
  () => {
    const PROMPT = 'add an audio output node'

    // Minimizing and restoring around a turn the client has NOT abandoned.
    // Nothing here is expected to fail, so this is what keeps `minimizePanel`,
    // `restorePanel`, `workingRow`, `workSummary` and `sendButton` honest:
    // `startTurn` only resolves once a live `Working...` row is on screen, and
    // the summary below only resolves once a turn has actually ended.
    // `stopButton` is covered instead by the pre-marker assertion in the first
    // test below. That leaves only the `Thinking...` arm of `liveProgressRow`
    // unproven, since nothing renders it until a fix restores a turn from REST.
    test('runs a turn to completion after a minimize and restore', async ({
      turnLock,
      getWebSocket
    }) => {
      await turnLock.openOnBlankWorkflow()
      await turnLock.minimizePanel()
      await turnLock.restorePanel()

      await turnLock.startTurn(PROMPT)
      await expect(turnLock.workSummary).toHaveCount(0)

      turnLock.push(await getWebSocket(), TURN_DONE_EVENT)

      await expect(turnLock.workSummary).toBeVisible()
      await expect(turnLock.sendButton).toBeVisible()
    })

    test.describe('minimized while a turn is still running', () => {
      test.beforeEach(async ({ turnLock }) => {
        await turnLock.openOnBlankWorkflow()
        await turnLock.startTurn(PROMPT)
      })

      test('keeps the turn marked as running after the panel is reopened', async ({
        turnLock
      }) => {
        await expect(turnLock.workingRow).toBeVisible()
        await expect(turnLock.stopButton).toBeVisible()
        await expect(turnLock.workSummary).toHaveCount(0)

        await turnLock.minimizePanel()
        await turnLock.restorePanel()

        // The thread itself must survive the minimize. A wipe here would be a
        // different defect, and test.fail() below would swallow it.
        await expect(turnLock.userBubbles).toHaveText([PROMPT])

        // The reported symptom, and the first assertion so the expected failure
        // is this one rather than a later line.
        test.fail()
        await expect(turnLock.liveProgressRow).toBeVisible()
        await expect(turnLock.stopButton).toBeVisible()
        await expect(turnLock.workSummary).toHaveCount(0)
      })

      test('keeps rendering the turn after the panel is reopened', async ({
        turnLock,
        getWebSocket
      }) => {
        await turnLock.minimizePanel()
        await turnLock.restorePanel()

        await expect(turnLock.userBubbles).toHaveText([PROMPT])

        // The server never stopped running this turn, so it keeps broadcasting
        // the same message_id. Sending stays above the marker: `ws.send()` throws
        // on a dead route, and below test.fail() that throw would read as the
        // expected failure without the assertion ever running.
        turnLock.push(await getWebSocket(), POST_RECONNECT_EVENT)

        // `agentConversationStore.ingest` drops the frame: `transport` is null
        // after the abort, hydrate created no replacement, and
        // `dropBackgroundTurns()` emptied the map it would fall back to.
        test.fail()
        await expect(
          turnLock.panel.getByText(POST_RECONNECT_TEXT)
        ).toBeVisible()
      })

      test('does not reject the next message after the panel is reopened', async ({
        turnLock
      }) => {
        await turnLock.minimizePanel()
        await turnLock.restorePanel()

        // Preconditions stay above the marker so a broken composer or a lost
        // prompt reads as a real failure rather than the expected one.
        await expect(turnLock.composer).toBeVisible()
        await expect(turnLock.userBubbles).toHaveText([PROMPT])

        // Composer renders Stop and Send as one button whose label flips, so
        // Stop being absent IS Send being offered -- the defect, asserted here
        // rather than left implicit. Once PM-1776 is fixed this test cannot
        // report "expected to fail, but passed": its arrange depends on Send,
        // which a restored turn removes. It fails loudly instead, by name here
        // and via the explicit 10s below, rather than burning the 120s file
        // timeout across CI retries -- and it must be rewritten alongside the
        // fix. All of it stays ABOVE test.fail(), which only sets the expected
        // status once it executes, so a throw up here stays unexpected.
        await expect(turnLock.stopButton).toHaveCount(0)
        await turnLock.composer.fill('are you still there?')
        await turnLock.sendButton.click({ timeout: 10_000 })
        // Inequality, so a future client-side retry cannot fail this line in
        // place of the alert assertion below.
        await expect
          .poll(() => turnLock.postAttempts())
          .toBeGreaterThanOrEqual(2)
        // `rejectedPosts` ticks synchronously inside the route handler, so the
        // poll above resolves before the browser has painted anything. Settle
        // on the rejected send's own bubble, which `recordFailedSend` pushes in
        // the same update as the notice, so the alert assertion below is a real
        // check rather than one that passes on an unrendered panel.
        await expect(turnLock.userBubbles).toHaveText([
          PROMPT,
          'are you still there?'
        ])

        test.fail()
        await expect(
          turnLock.panel
            .getByRole('alert')
            .filter({ hasText: TURN_IN_PROGRESS_MESSAGE })
        ).toHaveCount(0)
        expect(turnLock.rejectedPosts()).toBe(0)
      })
    })
  }
)
