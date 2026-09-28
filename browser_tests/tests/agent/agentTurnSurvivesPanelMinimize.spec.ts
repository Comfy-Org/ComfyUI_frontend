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
// Reopening remounts and re-hydrates from REST, which is where the client
// learns the turn is still running: `applyAssistantRow` in
// `agentTranscript.ts` now reads `row.status === 'streaming'` as the live
// turn, so hydrate rebuilds an active turn with a transport and the panel
// comes back showing work in progress instead of a finished thread.
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

    // Minimizing and restoring around a turn the client never started, so it
    // keeps `minimizePanel`, `restorePanel`, `workingRow`, `workSummary` and
    // `sendButton` honest independently of any restore: `startTurn` only
    // resolves once a live `Working...` row is on screen, and the summary
    // below only resolves once a turn has actually ended.
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

        await expect(turnLock.userBubbles).toHaveText([PROMPT])

        // The reported symptom: the panel came back looking like a finished
        // thread while the server was still building.
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
        // the same message_id. The restored turn has to be the one that
        // receives it: without a transport keyed to that id,
        // `agentConversationStore.ingest` drops the frame on the floor.
        turnLock.push(await getWebSocket(), POST_RECONNECT_EVENT)

        await expect(
          turnLock.panel.getByText(POST_RECONNECT_TEXT)
        ).toBeVisible()
      })

      test('does not reject the next message after the panel is reopened', async ({
        turnLock
      }) => {
        await turnLock.minimizePanel()
        await turnLock.restorePanel()

        await expect(turnLock.composer).toBeVisible()
        await expect(turnLock.userBubbles).toHaveText([PROMPT])

        // Composer renders Stop and Send as one button whose label flips, so
        // Send being absent IS Stop being offered: the restored turn withholds
        // the send the server would answer with 409.
        await expect(turnLock.sendButton).toHaveCount(0)
        await expect(turnLock.stopButton).toBeVisible()

        // Enter is the one affordance left that could still post. A running
        // turn swallows it, so the draft staying in the composer is the settle
        // that makes the three negative assertions below real checks rather
        // than ones that pass on a send still in flight.
        await turnLock.composer.fill('are you still there?')
        await turnLock.composer.press('Enter')
        await expect(turnLock.composer).toHaveText('are you still there?')

        await expect(turnLock.userBubbles).toHaveText([PROMPT])
        await expect(
          turnLock.panel
            .getByRole('alert')
            .filter({ hasText: TURN_IN_PROGRESS_MESSAGE })
        ).toHaveCount(0)
        expect(turnLock.postAttempts()).toBe(1)
        expect(turnLock.rejectedPosts()).toBe(0)
      })
    })
  }
)
