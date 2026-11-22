import { expect } from '@playwright/test'

import { agentTurnLockTest as test } from '@e2e/fixtures/agentTurnLockFixture'

test.use({ connectWebSocketToServer: false })
test.describe.configure({ timeout: 120_000 })

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
        await expect(turnLock.sendButton).toBeVisible()
      })

      await test.step('the refused send re-attaches rather than dead-ending', async () => {
        await turnLock.composer.fill('and now add a save node')
        await turnLock.sendButton.click()

        await expect.poll(() => turnLock.rejectedPosts()).toBe(1)
        await expect(turnLock.stopButton).toBeVisible({ timeout: 20_000 })
        await expect(turnLock.sendButton).toHaveCount(0)
        await expect(turnLock.liveProgressRow).toBeVisible()
        await expect(turnLock.panel.getByText('run it again')).toBeVisible()
        await expect(turnLock.turnInProgressNotice).toBeVisible()
      })

      await test.step('stopping it unlocks the composer and the retry is accepted', async () => {
        const foreignTurnCancelled = turnLock.waitForForeignTurnCancellation()
        await turnLock.stopButton.click()
        await foreignTurnCancelled
        turnLock.finishForeignTurn(live)

        await expect(turnLock.sendButton).toBeVisible({ timeout: 20_000 })
        await turnLock.composer.fill('and now add a save node')
        await turnLock.sendButton.click()

        await expect.poll(() => turnLock.postAttempts()).toBe(3)
        expect(turnLock.rejectedPosts()).toBe(1)
      })
    })
  }
)
