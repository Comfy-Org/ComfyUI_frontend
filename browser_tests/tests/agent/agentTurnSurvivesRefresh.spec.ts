import { expect } from '@playwright/test'

import { agentTurnLockTest as test } from '@e2e/fixtures/agentTurnLockFixture'

test.describe.configure({ timeout: 120_000 })
test.use({ connectWebSocketToServer: false })

test(
  'settles a turn after refresh when completion arrives only through history',
  { tag: ['@cloud', '@ui'] },
  async ({ page, turnLock }) => {
    const prompt = 'add an audio output node'
    await turnLock.openOnBlankWorkflow()
    await turnLock.startTurn(prompt)

    await test.step('refresh keeps the in-flight turn running', async () => {
      await page.reload()

      await expect(turnLock.userBubbles).toHaveText([prompt], {
        timeout: 30_000
      })
      await expect(turnLock.stopButton).toBeVisible()
      await expect(turnLock.sendButton).toHaveCount(0)
    })

    await test.step('completion seen only in history unlocks the composer', async () => {
      turnLock.finishTurn()

      await expect(turnLock.sendButton).toBeVisible({ timeout: 20_000 })
      await expect(turnLock.stopButton).toHaveCount(0)
      await expect(turnLock.userBubbles).toHaveText([prompt])
      expect(turnLock.postAttempts()).toBe(1)
      expect(turnLock.rejectedPosts()).toBe(0)
    })
  }
)
