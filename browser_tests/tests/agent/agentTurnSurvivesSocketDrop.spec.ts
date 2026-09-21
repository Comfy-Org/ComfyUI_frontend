import { expect } from '@playwright/test'

import {
  POST_RECONNECT_EVENT,
  POST_RECONNECT_TEXT,
  TURN_DONE_EVENT,
  TURN_IN_PROGRESS_MESSAGE,
  agentTurnLockTest as test
} from '@e2e/fixtures/agentTurnLockFixture'

// PM-1199 / PM-1200. Reported after a long auto-mode run: the action stream
// stopped updating, the "Working..." row was replaced by a "Worked for 3m"
// summary as if the turn had finished, and the next message came back
// "Message failed to send: a turn is already in progress for this thread" —
// with no refresh and no tab close anywhere in the journey.
//
// The agent chat stream rides the shared ComfyUI websocket, so any transient
// close dispatches `reconnecting`. `useAgentSession.onStatus(false)` answers it
// with `abortActiveTurn()`, which settles the assistant message locally, while
// `onStatus(true)` only sets a flag — nothing re-attaches. The server never saw
// the socket go away, so its assistant row is still `streaming` and it keeps
// answering posts with 409. These specs close one socket and hold the client to
// the three things the user watched break.
//
// Deliberately not a refresh or a tab reopen: PM-1154 and PM-1043 cover those
// triggers. Here the page is never reloaded — only the socket blips.
test.describe.configure({ timeout: 120_000 })
test.use({ connectWebSocketToServer: false })

test.describe(
  'Agent turn across a transient websocket reconnect',
  { tag: ['@cloud', '@ui'] },
  () => {
    const PROMPT = 'add an audio output node'

    test.beforeEach(async ({ turnLock }) => {
      await turnLock.openOnBlankWorkflow()
      await turnLock.startTurn(PROMPT)
    })

    test('keeps rendering the turn after the socket reconnects', async ({
      turnLock
    }) => {
      const reconnected = await turnLock.dropSocket()

      // The thread itself must survive the blip. A wipe here would be a
      // different defect, and test.fail() below would swallow it. (The agent's
      // narration is deliberately not asserted: settling the turn collapses it
      // into the closed "Worked for ..." summary, which is the very thing the
      // next test pins.)
      await expect(turnLock.userBubbles).toHaveText([PROMPT])

      // The server never stopped running this turn, so it keeps broadcasting the
      // same message_id down the new socket. Sending it stays above the marker
      // with the rest of the arrange: `ws.send()` throws on a dead route, and
      // below test.fail() that throw would read as the expected failure without
      // the assertion ever running.
      turnLock.push(reconnected, POST_RECONNECT_EVENT)

      // `agentConversationStore.ingest` drops every one of those frames:
      // `transport` is null after the abort, and `dropBackgroundTurns()` emptied
      // the map it would otherwise fall back to.
      test.fail()
      await expect(turnLock.panel.getByText(POST_RECONNECT_TEXT)).toBeVisible()
    })

    test('keeps the turn marked as running after the socket reconnects', async ({
      turnLock
    }) => {
      await expect(turnLock.stopButton).toBeVisible()
      await expect(turnLock.workSummary).toHaveCount(0)

      await turnLock.dropSocket()

      // `abortActiveTurn()` calls `transport.settle()`, which flips
      // `message.streaming` to false. AgentMessage.vue swaps ActivityTrace for
      // WorkSummary on exactly that flag, so the live rows collapse into the
      // "Worked for ..." button the user saw, the Working... row disappears and
      // Stop reverts to Send — while the server still owns the turn.
      test.fail()
      await expect(turnLock.stopButton).toBeVisible()
      await expect(turnLock.workSummary).toHaveCount(0)
      await expect(turnLock.workingRow).toBeVisible()
    })

    // PM-916 / PM-938. The composer remains editable while a turn is active,
    // but Enter must preserve the next draft instead of becoming a hidden Stop.
    test('preserves a new draft when Enter is pressed during an active turn', async ({
      turnLock
    }) => {
      const nextDraft = 'make the output warmer'
      await turnLock.composer.fill(nextDraft)
      await turnLock.composer.press('Enter')

      await expect(turnLock.composer).toHaveText(nextDraft)
      await expect(turnLock.stopButton).toBeVisible()
      expect(turnLock.postAttempts()).toBe(1)
    })

    test('does not reject the next message after the socket reconnects', async ({
      turnLock
    }) => {
      await turnLock.dropSocket()

      // Preconditions stay above the marker so a broken composer or a lost
      // prompt reads as a real failure rather than the expected one. Send
      // visibility is deliberately not asserted here: Send replacing Stop is
      // itself part of the defect.
      await expect(turnLock.composer).toBeVisible()
      await expect(turnLock.userBubbles).toHaveText([PROMPT])

      // The abandoned turn puts Send back in front of the user, so the nudge
      // reaches a thread the server still has locked and comes back 409
      // TURN_IN_PROGRESS.
      //
      // The nudge stays ABOVE test.fail(): body-level test.fail() only sets the
      // expected status when it executes, so a throw up here is still an
      // unexpected failure. Once the client re-attaches there is no Send
      // button, and this click reports that by name in seconds instead of
      // running out the file timeout four times over under CI retries.
      await turnLock.composer.fill('are you still there?')
      await turnLock.sendButton.click({ timeout: 10_000 })
      // Inequality, so a future client-side retry cannot fail this line in
      // place of the alert assertion below.
      await expect.poll(() => turnLock.postAttempts()).toBeGreaterThanOrEqual(2)

      test.fail()
      await expect(
        turnLock.panel
          .getByRole('alert')
          .filter({ hasText: TURN_IN_PROGRESS_MESSAGE })
      ).toHaveCount(0)
      expect(turnLock.rejectedPosts()).toBe(0)
    })

    // Keeps the `workSummary` locator honest. Every other use of it above is a
    // toHaveCount(0), which a locator that matched nothing would satisfy for
    // free; this shows it does resolve once a turn ends.
    test('summarises a turn that ends normally', async ({
      turnLock,
      getWebSocket
    }) => {
      await expect(turnLock.workSummary).toHaveCount(0)

      turnLock.push(await getWebSocket(), TURN_DONE_EVENT)

      await expect(turnLock.workSummary).toBeVisible()
      await expect(turnLock.sendButton).toBeVisible()
    })

    // The report mentions audio playback right before the disconnect. What
    // shows it was incidental is really the three specs above, which reproduce
    // every symptom with no audio anywhere; this only adds that Web Audio
    // decoding beside a live turn leaves it alone. It does not call the
    // product's player, so it does not clear the whole audio path.
    test('keeps the turn running while audio decoding runs alongside it', async ({
      turnLock,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      await turnLock.decodeAudioLikeAPreview()

      await expect(turnLock.stopButton).toBeVisible()
      await expect(turnLock.workSummary).toHaveCount(0)

      turnLock.push(ws, POST_RECONNECT_EVENT)
      await expect(turnLock.panel.getByText(POST_RECONNECT_TEXT)).toBeVisible()
    })
  }
)
