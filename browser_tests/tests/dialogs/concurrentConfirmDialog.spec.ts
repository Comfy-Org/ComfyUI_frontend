import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { expect } from '@playwright/test'

declare global {
  interface Window {
    __confirmOutcomes?: string[]
  }
}

/**
 * `prompt()` and `confirm()` share one dialog-stack key, and `showDialog`
 * raises an existing dialog with that key instead of wiring the new caller's
 * callbacks. Two extensions confirming at once therefore used to leave the
 * second promise pending forever. Both are driven through
 * `extensionManager.dialog`, the public API an extension would call.
 */
test.describe('Concurrent confirm dialogs', () => {
  test('settles both promises when two confirmations are requested at once', async ({
    comfyPage
  }) => {
    await comfyPage.page.evaluate(() => {
      window.__confirmOutcomes = []
      const { dialog } = window.app!.extensionManager
      const record = (label: string) => (value: boolean | null) => {
        window.__confirmOutcomes!.push(`${label}:${String(value)}`)
      }

      void dialog
        .confirm({ title: 'First', type: 'default', message: 'first request' })
        .then(record('first'))
      void dialog
        .confirm({
          title: 'Second',
          type: 'default',
          message: 'second request'
        })
        .then(record('second'))
    })

    const { root, confirm, reject } = comfyPage.confirmDialog
    await expect(root).toBeVisible()
    await expect(root).toContainText('first request')

    await confirm.click()

    // The queued second confirmation takes the freed key rather than being lost.
    await expect(root).toContainText('second request')

    // Cancel settles through onRemoved, the hook the queue releases on.
    await reject.click()
    await expect(root).toBeHidden()

    await expect
      .poll(() => comfyPage.page.evaluate(() => window.__confirmOutcomes))
      .toEqual(['first:true', 'second:null'])
  })
})
