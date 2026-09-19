import { expect } from '@playwright/test'

import {
  POST_RECONNECT_EVENT,
  POST_RECONNECT_TEXT,
  TURN_DONE_EVENT,
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
      // same message_id down the new socket. `agentConversationStore.ingest`
      // drops every one of them: `transport` is null after the abort, and
      // `dropBackgroundTurns()` emptied the map it would otherwise fall back to.
      test.fail()
      turnLock.push(reconnected, POST_RECONNECT_EVENT)
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
      // TURN_IN_PROGRESS. Once the client re-attaches Send is gone, and the
      // bounded click below then times out in seconds — loudly red, since
      // test.fail() accepts a failed assertion but not a timeout — rather than
      // burning the suite timeout. Whoever lands the fix should rewrite this
      // around the Stop state.
      test.fail()
      await turnLock.composer.fill('are you still there?')
      await turnLock.sendButton.click({ timeout: 5_000 })
      // Wait for the nudge to actually reach the server, or the assertion below
      // could pass on a race and flip this expected failure green. Inequality,
      // so a future client-side retry cannot fail this line instead.
      await expect.poll(() => turnLock.postAttempts()).toBeGreaterThanOrEqual(2)
      await expect(turnLock.panel.getByRole('alert')).toHaveCount(0)
      expect(turnLock.rejectedPosts()).toBe(0)
    })

    // The report mentions audio playback right before the disconnect, so this
    // is the control: the audio-output widget and the asset-library preview
    // both decode through `useWaveAudioPlayer.decodeAudioSource`, and running
    // that decode mid-turn leaves the turn alone. It passes today, and the
    // three above need no audio at all — together that is what makes the
    // playback incidental rather than causal.
    //
    // It also carries the only positive assertion on `workSummary`: a turn that
    // ends normally must produce the summary, so the negative assertions above
    // cannot be passing on a locator that matches nothing.
    test('keeps the turn running while an audio preview decodes', async ({
      turnLock,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      await turnLock.decodeAudioLikeThePlayer()

      await expect(turnLock.stopButton).toBeVisible()
      await expect(turnLock.workSummary).toHaveCount(0)

      turnLock.push(ws, POST_RECONNECT_EVENT)
      await expect(turnLock.panel.getByText(POST_RECONNECT_TEXT)).toBeVisible()

      turnLock.push(ws, TURN_DONE_EVENT)
      await expect(turnLock.workSummary).toBeVisible()
      await expect(turnLock.sendButton).toBeVisible()
    })
  }
)
