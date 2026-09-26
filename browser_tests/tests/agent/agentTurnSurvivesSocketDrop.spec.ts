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
// close dispatches `reconnecting`. The server never sees the socket go away:
// its assistant row stays `streaming`, it keeps broadcasting the same
// message_id down the new socket, and it answers posts with 409 until the turn
// really ends. These specs close one socket and hold the client to keeping the
// turn live through the blip: frames on the new socket still render, Stop
// stays in front of the user, and the next message goes out only once the turn
// has actually finished.
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

      await expect(turnLock.userBubbles).toHaveText([PROMPT])

      turnLock.push(reconnected, POST_RECONNECT_EVENT)

      await expect(turnLock.panel.getByText(POST_RECONNECT_TEXT)).toBeVisible()
    })

    test('keeps the turn marked as running after the socket reconnects', async ({
      turnLock
    }) => {
      await expect(turnLock.stopButton).toBeVisible()
      await expect(turnLock.workSummary).toHaveCount(0)

      await turnLock.dropSocket()

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
      const nextPrompt = 'are you still there?'

      const reconnected =
        await test.step('drop the socket while the turn is live', async () => {
          const ws = await turnLock.dropSocket()

          await expect(turnLock.composer).toBeVisible()
          await expect(turnLock.userBubbles).toHaveText([PROMPT])
          await expect(turnLock.stopButton).toBeVisible()
          return ws
        })

      await test.step('finish the turn on the new socket', async () => {
        turnLock.finishTurn(reconnected)

        await expect(turnLock.workSummary).toBeVisible()
        await expect(turnLock.sendButton).toBeVisible()
      })

      await test.step('send the next message', async () => {
        await turnLock.composer.fill(nextPrompt)
        await turnLock.sendButton.click()
        // Inequality, so a future client-side retry cannot fail this line in
        // place of the alert assertion below.
        await expect
          .poll(() => turnLock.postAttempts())
          .toBeGreaterThanOrEqual(2)
        await expect(turnLock.userBubbles).toHaveCount(2)
        await expect(turnLock.userBubbles.last()).toHaveText(nextPrompt)
      })

      await test.step('the server did not answer 409', async () => {
        await expect(turnLock.stopButton).toBeVisible()
        await expect(
          turnLock.panel
            .getByRole('alert')
            .filter({ hasText: TURN_IN_PROGRESS_MESSAGE })
        ).toHaveCount(0)
        expect(turnLock.rejectedPosts()).toBe(0)
      })
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
