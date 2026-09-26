import { expect } from '@playwright/test'

import { agentTurnLockTest as test } from '@e2e/fixtures/agentTurnLockFixture'

// PM-1658 / PM-1659. Reported after a consent card was left unanswered for an
// hour and a half: coming back, Cancel and Run both did nothing at all. The
// wait itself was incidental. The agent chat rides the shared ComfyUI
// websocket, so any transient close dispatches `reconnecting`, and
// `useAgentSession.onStatus(false)` answers it with `abortActiveTurn()` —
// which nulls `activeTurnId` and disposes the transport while the turn's parts,
// the card among them, stay on screen.
//
// These specs hold the card to the two things that has to mean: a click still
// reaches the server, and the card never outlives its own answer. They close
// the socket rather than wait, because the wait was never the trigger.
test.describe.configure({ timeout: 120_000 })
test.use({ connectWebSocketToServer: false })

test.describe(
  'Run approval across a transient websocket reconnect',
  { tag: ['@cloud', '@ui'] },
  () => {
    const PROMPT = 'build a text to image workflow and run it'

    test.beforeEach(async ({ turnLock, getWebSocket }) => {
      await turnLock.openOnBlankWorkflow()
      await turnLock.startTurn(PROMPT)
      await turnLock.parkOnRunApproval(await getWebSocket())
    })

    // The card looking usable is what made this bug invisible - both buttons
    // stayed enabled throughout, so the clicks that reached nothing looked
    // exactly like clicks that worked. Pin the appearance AND the effect
    // together, so the appearance alone can never carry this case.
    test('leaves both actions usable after the socket reconnects', async ({
      turnLock
    }) => {
      await turnLock.dropSocket()

      await expect(turnLock.approvalCard).toBeVisible()
      await expect(turnLock.approveButton).toBeEnabled()
      await expect(turnLock.cancelApprovalButton).toBeEnabled()

      await turnLock.cancelApprovalButton.click()
      await expect.poll(() => turnLock.answerAttempts()).toEqual([['cancel']])
    })

    test('sends Run after the socket reconnects, and dismisses the card', async ({
      turnLock
    }) => {
      await turnLock.dropSocket()

      await turnLock.approveButton.click()

      await expect.poll(() => turnLock.answerAttempts()).toEqual([['run']])
      await expect(turnLock.approvalCard).toHaveCount(0)
    })

    test('sends Cancel after the socket reconnects, and dismisses the card', async ({
      turnLock
    }) => {
      await turnLock.dropSocket()

      await turnLock.cancelApprovalButton.click()

      await expect.poll(() => turnLock.answerAttempts()).toEqual([['cancel']])
      await expect(turnLock.approvalCard).toHaveCount(0)
    })

    // The card is deliberately held disabled between a click and the server's
    // resolution frame. A drop inside that window strands it there, and the
    // card must come off the screen rather than back into service: the server
    // has already committed this answer, and it replays that stored selection
    // for any repeat, so a second click would be discarded while the card
    // vanished as though the new choice had taken effect.
    test('dismisses a card whose resolution frame the drop cut off', async ({
      turnLock,
      getWebSocket,
      page
    }) => {
      const live = await getWebSocket()
      // Awaited before the close so the answer is provably COMMITTED, not
      // still in flight — otherwise the card could be dismissed by the
      // in-flight path and this would pass without covering its subject.
      const accepted = page.waitForResponse(
        (response) =>
          response.url().includes('/answer') && response.status() === 202
      )
      await turnLock.approveButton.click()
      await accepted
      await expect.poll(() => turnLock.answerAttempts()).toEqual([['run']])
      await expect(turnLock.approveButton).toBeDisabled()

      await live.close()

      await expect(turnLock.approvalCard).toHaveCount(0)
      await expect(turnLock.approveButton).toHaveCount(0)
      await expect(turnLock.cancelApprovalButton).toHaveCount(0)
      expect(turnLock.committedAnswer()).toEqual(['run'])
      expect(turnLock.answerAttempts()).toEqual([['run']])
    })
  }
)
