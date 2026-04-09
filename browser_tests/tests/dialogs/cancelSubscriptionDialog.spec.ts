import { expect } from '@playwright/test'

import type { WorkspaceStore } from '@e2e/types/globals'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('CancelSubscription dialog', { tag: '@ui' }, () => {
  test('displays dialog with title and description', async ({ comfyPage }) => {
    const { page } = comfyPage

    await page.evaluate(() => {
      void (
        window.app!.extensionManager as WorkspaceStore
      ).dialog.showCancelSubscriptionDialog('2025-12-31T12:00:00Z')
    })

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await expect(
      dialog.getByRole('heading', { name: 'Cancel subscription' })
    ).toBeVisible()
    await expect(dialog).toContainText('December 31, 2025')
  })

  test('"Keep subscription" button closes dialog', async ({ comfyPage }) => {
    const { page } = comfyPage

    await page.evaluate(() => {
      void (
        window.app!.extensionManager as WorkspaceStore
      ).dialog.showCancelSubscriptionDialog()
    })

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: 'Keep subscription' }).click()
    await expect(dialog).toBeHidden()
  })

  test('Escape key closes dialog', async ({ comfyPage }) => {
    const { page } = comfyPage

    await page.evaluate(() => {
      void (
        window.app!.extensionManager as WorkspaceStore
      ).dialog.showCancelSubscriptionDialog()
    })

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('"Cancel subscription" button is clickable', async ({ comfyPage }) => {
    const { page } = comfyPage

    await page.evaluate(() => {
      void (
        window.app!.extensionManager as WorkspaceStore
      ).dialog.showCancelSubscriptionDialog()
    })

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    const cancelBtn = dialog.getByRole('button', {
      name: 'Cancel subscription'
    })
    await expect(cancelBtn).toBeVisible()
    await expect(cancelBtn).toBeEnabled()
  })
})
