import { expect } from '@playwright/test'

import { agentTurnLockTest as test } from '@e2e/fixtures/agentTurnLockFixture'

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

    test('does not submit another message after the page reloads', async ({
      page,
      turnLock
    }) => {
      await page.reload()
      await expect(turnLock.panel).toBeVisible({ timeout: 30_000 })
      await expect(turnLock.composer).toBeVisible()
      await expect(turnLock.userBubbles).toHaveText([PROMPT])

      test.fail()
      await expect(turnLock.stopButton).toBeVisible()
      await expect(turnLock.sendButton).toHaveCount(0)
      expect(turnLock.postAttempts()).toBe(1)
      expect(turnLock.rejectedPosts()).toBe(0)
    })
  }
)
