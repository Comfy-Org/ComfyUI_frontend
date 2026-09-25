import { expect } from '@playwright/test'

import {
  TURN_IN_PROGRESS_MESSAGE,
  agentTurnLockTest as test
} from '@e2e/fixtures/agentTurnLockFixture'

// "After a refresh I cannot tell the agent is working, and my next message is
// rejected" -- `qa/user-story-test-matrix.md` rank 14 in the in-app-agent
// program repo (`slack-19`, `linear-10`). The user refreshes while a turn is
// running: every busy indicator comes back idle, so the composer invites
// another message, and that message comes back "a turn is already in progress
// for this thread".
//
// This is the refresh trigger `agentTurnSurvivesSocketDrop.spec.ts` explicitly
// leaves to PM-1154 / PM-1043 ("Deliberately not a refresh or a tab reopen"),
// and no spec had picked it up. The two failures are close relatives but not
// the same one: there the socket blips and `onStatus(false)` settles the turn
// locally, while here the page is torn down entirely and the client rebuilds
// its view of the turn from `hydrateFromServer`. The server's assistant row is
// still `streaming` in both cases, which is why the same 409 lands at the end
// of both journeys.
//
// Both tests below are expected failures against current `main`, verified
// against this fixture: after the reload the panel offers Send, shows no
// working row and no elapsed-time summary, and the nudge is rejected.
test.describe.configure({ timeout: 120_000 })
test.use({ connectWebSocketToServer: false })

test.describe(
  'Agent turn across a browser refresh',
  { tag: ['@cloud', '@ui'] },
  () => {
    const PROMPT = 'add an audio output node'

    test.beforeEach(async ({ turnLock }) => {
      await turnLock.openOnBlankWorkflow()
      await turnLock.startTurn(PROMPT)
      // The turn really is live before the reload, so what the reload loses is
      // attributable to the reload.
      await expect(turnLock.stopButton).toBeVisible()
    })

    test('keeps the turn marked as running after the page reloads', async ({
      page,
      turnLock
    }) => {
      await page.reload()
      await expect(turnLock.panel).toBeVisible({ timeout: 30_000 })

      // Preconditions stay above the marker so a panel that failed to come
      // back, or a transcript that did not survive, reads as a real failure
      // rather than the expected one. `agentChatRefreshPersistence.spec.ts`
      // owns the transcript guarantee; it is asserted here only to prove this
      // spec got far enough to be testing the busy state at all.
      await expect(turnLock.userBubbles).toHaveText([PROMPT])
      await expect(turnLock.composer).toBeVisible()

      // The server never stopped running this turn. The panel has to come
      // back still showing it running -- Stop, not Send -- or the user is
      // invited into the rejection the next test pins.
      test.fail()
      await expect(turnLock.stopButton).toBeVisible()
      await expect(turnLock.sendButton).toHaveCount(0)
    })

    test('does not reject the next message after the page reloads', async ({
      page,
      turnLock
    }) => {
      await page.reload()
      await expect(turnLock.panel).toBeVisible({ timeout: 30_000 })
      await expect(turnLock.composer).toBeVisible()
      await expect(turnLock.userBubbles).toHaveText([PROMPT])

      // The idle-looking composer puts Send back in front of the user, so the
      // nudge reaches a thread the server still has locked and comes back 409.
      //
      // The nudge stays ABOVE test.fail(): a body-level test.fail() only sets
      // the expected status once it executes, so a throw up here would be an
      // unexpected failure. Once the client re-attaches to the running turn
      // there is no Send button, and this click reports that by name in
      // seconds rather than running out the file timeout.
      await turnLock.composer.fill('are you still there?')
      await turnLock.sendButton.click({ timeout: 10_000 })
      // Inequality, so a future client-side retry cannot satisfy this line in
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
  }
)
