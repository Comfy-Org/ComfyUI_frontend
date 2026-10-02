import { expect } from '@playwright/test'

import { agentTurnLockTest as test } from '@e2e/fixtures/agentTurnLockFixture'

test.use({ connectWebSocketToServer: false })

/**
 * FE-1998, the half that composer gating does not reach.
 *
 * A turn this client can see renders Stop in place of Send, so it can never
 * reach the server's active-turn guard. A turn started from a *second* tab,
 * window or device can: this client's composer offers Send, the post is refused
 * `409 TURN_IN_PROGRESS`, and before this change the user was left with the raw
 * server string, no stop control, and no way to tell a working turn from a dead
 * one — the dead end the ticket is named for.
 *
 * The server hands the client everything needed to recover (`type`,
 * `active_message_id`, `turn_id`; cloud #8275). These assertions are about
 * whether the panel acts on it.
 */
test.describe(
  'a send refused because another client holds the thread',
  { tag: ['@cloud', '@ui'] },
  () => {
    test('re-attaches to the running turn and offers Stop instead of a dead end', async ({
      turnLock
    }) => {
      await turnLock.openOnBlankWorkflow()
      const live = await turnLock.liveSocket()
      await turnLock.startTurn('add an audio output node')
      turnLock.finishTurn(live)
      await expect(turnLock.sendButton).toBeVisible()

      await test.step('another client starts a turn on the same thread', async () => {
        turnLock.lockThreadFromAnotherClient('run it again')
        // No local signal: nothing has told this panel the thread is busy, so
        // Send is still the control on offer. That is what makes the next send
        // reach the guard at all.
        await expect(turnLock.sendButton).toBeVisible()
      })

      await test.step('the refused send re-attaches rather than dead-ending', async () => {
        await turnLock.composer.fill('and now add a save node')
        await turnLock.sendButton.click()

        await expect.poll(() => turnLock.rejectedPosts()).toBe(1)
        // The fix: the thread was re-read, the still-running turn adopted, and
        // the composer's primary action is now the escape hatch.
        await expect(turnLock.stopButton).toBeVisible({ timeout: 20_000 })
        await expect(turnLock.sendButton).toHaveCount(0)
        await expect(turnLock.liveProgressRow).toBeVisible()
        await expect(turnLock.panel.getByText('run it again')).toBeVisible()
        // The notice names the recovery; the raw server string described a
        // control the user is already looking at.
        await expect(turnLock.turnInProgressNotice).toBeVisible()
        await expect(turnLock.rawRefusalText).toHaveCount(0)
      })

      await test.step('stopping it unlocks the composer and the retry is accepted', async () => {
        const foreignTurnCancelled = turnLock.waitForForeignTurnCancellation()
        await turnLock.stopButton.click()
        await foreignTurnCancelled
        turnLock.finishForeignTurn(live)

        await expect(turnLock.sendButton).toBeVisible({ timeout: 40_000 })
        await turnLock.composer.fill('and now add a save node')
        await turnLock.sendButton.click()

        await expect.poll(() => turnLock.postAttempts()).toBe(3)
        // Still one: the retry was accepted, so no second refusal. This is the
        // ticket's acceptance criterion — the next send succeeds with no reload.
        expect(turnLock.rejectedPosts()).toBe(1)
      })
    })
  }
)
