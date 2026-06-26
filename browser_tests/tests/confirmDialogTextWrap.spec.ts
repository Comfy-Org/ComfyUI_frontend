import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Confirm dialog text wrapping', { tag: ['@mobile'] }, () => {
  test('@mobile confirm dialog buttons are visible with long unbreakable text', async ({
    comfyPage
  }) => {
    const longFilename = 'workflow_checkpoint_' + 'a'.repeat(200) + '.json'

    await comfyPage.page.evaluate((msg) => {
      window
        .app!.extensionManager.dialog.confirm({
          title: 'Confirm',
          type: 'default',
          message: msg
        })
        .catch(() => {})
    }, longFilename)

    const { root, confirm, reject } = comfyPage.confirmDialog
    await expect(root).toBeVisible()

    await expect(confirm).toBeVisible()
    await expect(confirm).toBeInViewport()

    await expect(reject).toBeVisible()
    await expect(reject).toBeInViewport()
  })
})
