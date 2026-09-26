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

      await turnLock.composer.fill('are you still there?')
      await turnLock.sendButton.click({ timeout: 10_000 })
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
