import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  POST_RECONNECT_EVENT,
  POST_RECONNECT_TEXT,
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

      // The abandoned turn puts Send back in front of the user, so the nudge
      // reaches a thread the server still has locked and comes back 409
      // TURN_IN_PROGRESS. Once the client re-attaches, the composer will offer
      // Stop instead and this test should be rewritten around that; today it
      // pins the dead end the report ends on.
      test.fail()
      await turnLock.composer.fill('are you still there?')
      await turnLock.sendButton.click()
      await expect(turnLock.panel.getByRole('alert')).toHaveCount(0)
      expect(turnLock.rejectedPosts()).toBe(0)
    })

    // The report mentions audio playback right before the disconnect, so this is
    // the control. It runs the same Web Audio work the audio-output widget and
    // the asset-library preview do (`useWaveAudioPlayer.decodeAudioSource`
    // builds an AudioContext, decodes into it, then closes it) while the turn is
    // live. This one passes today: the three above need no audio at all, which
    // is what makes the playback incidental rather than causal.
    test('keeps the turn running while audio plays in the page', async ({
      turnLock,
      getWebSocket
    }) => {
      await turnLock.panel.evaluate(async () => {
        const context = new AudioContext()
        const buffer = context.createBuffer(
          1,
          context.sampleRate / 10,
          context.sampleRate
        )
        const source = context.createBufferSource()
        source.buffer = buffer
        source.connect(context.destination)
        source.start()
        await context.close()
      })

      await expect(turnLock.stopButton).toBeVisible()
      await expect(turnLock.workSummary).toHaveCount(0)

      turnLock.push(await getWebSocket(), POST_RECONNECT_EVENT)
      await expect(turnLock.panel.getByText(POST_RECONNECT_TEXT)).toBeVisible()
      await expect(
        turnLock.panel.getByText(enMessages.agent.sendFailed)
      ).toHaveCount(0)
    })
  }
)
