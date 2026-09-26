import { expect } from '@playwright/test'

import {
  TURN_IN_PROGRESS_MESSAGE,
  agentTurnLockTest as test
} from '@e2e/fixtures/agentTurnLockFixture'

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
      await expect(turnLock.stopButton).toBeVisible()
    })

    test('keeps the turn marked as running after the page reloads', async ({
      page,
      turnLock
    }) => {
      await page.reload()
      await expect(turnLock.panel).toBeVisible({ timeout: 30_000 })

      await expect(turnLock.userBubbles).toHaveText([PROMPT])
      await expect(turnLock.composer).toBeVisible()

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
      // Settle on one of the two composer states before reading which one it
      // chose. Without this a slow hydration would look like an idle panel and
      // the guard below would skip the whole point of the test.
      await expect(turnLock.sendButton.or(turnLock.stopButton)).toBeVisible()

      test.fail()
      // The busy state is the test above; this one owns what happens to the
      // message the user is invited to send. The send is guarded rather than
      // unconditional because the two states are mutually exclusive: once the
      // turn comes back marked running there is no Send to click, and an
      // unconditional click would time out and report a hard failure instead of
      // the unexpected pass that signals the fix.
      if ((await turnLock.sendButton.count()) > 0) {
        await turnLock.composer.fill('are you still there?')
        await turnLock.sendButton.click({ timeout: 10_000 })
        // Wait for the post to actually reach the fake server, so the assertion
        // below cannot pass just by running before the alert renders.
        await expect
          .poll(() => turnLock.postAttempts())
          .toBeGreaterThanOrEqual(2)
        await expect(
          turnLock.panel
            .getByRole('alert')
            .filter({ hasText: TURN_IN_PROGRESS_MESSAGE })
        ).toHaveCount(0)
        expect(turnLock.rejectedPosts()).toBe(0)
      }
    })
  }
)
