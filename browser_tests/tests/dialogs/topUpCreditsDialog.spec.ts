import { expect } from '@playwright/test'

import type { WorkspaceStore } from '@e2e/types/globals'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('TopUpCredits dialog', { tag: '@ui' }, () => {
  test('displays dialog with heading and preset amounts', async ({
    comfyPage
  }) => {
    const { page } = comfyPage

    await page.evaluate(() => {
      void (
        window.app!.extensionManager as WorkspaceStore
      ).dialog.showTopUpCreditsDialog()
    })

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await expect(
      dialog.getByRole('heading', { name: 'Add more credits' })
    ).toBeVisible()

    await expect(
      dialog.getByRole('button', { name: '$10' }).first()
    ).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: '$25' }).first()
    ).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: '$50' }).first()
    ).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: '$100' }).first()
    ).toBeVisible()
  })

  test('displays insufficient credits message when opened with flag', async ({
    comfyPage
  }) => {
    const { page } = comfyPage

    await page.evaluate(() => {
      void (
        window.app!.extensionManager as WorkspaceStore
      ).dialog.showTopUpCreditsDialog({ isInsufficientCredits: true })
    })

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await expect(
      dialog.getByRole('heading', { name: 'Add more credits to run' })
    ).toBeVisible()
    await expect(dialog).toContainText(
      "You don't have enough credits to run this workflow"
    )
  })

  test('selecting a preset amount updates the selection', async ({
    comfyPage
  }) => {
    const { page } = comfyPage

    await page.evaluate(() => {
      void (
        window.app!.extensionManager as WorkspaceStore
      ).dialog.showTopUpCreditsDialog()
    })

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: '$10' }).first().click()

    await expect(dialog).toContainText('Credits')
  })

  test('close button dismisses dialog', async ({ comfyPage }) => {
    const { page } = comfyPage

    await page.evaluate(() => {
      void (
        window.app!.extensionManager as WorkspaceStore
      ).dialog.showTopUpCreditsDialog()
    })

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    const closeButton = dialog.getByRole('button').filter({
      has: page.locator('i.icon-\\[lucide--x\\]')
    })
    await closeButton.click()

    await expect(dialog).toBeHidden()
  })

  test('shows pricing details link', async ({ comfyPage }) => {
    const { page } = comfyPage

    await page.evaluate(() => {
      void (
        window.app!.extensionManager as WorkspaceStore
      ).dialog.showTopUpCreditsDialog()
    })

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await expect(
      dialog.getByRole('link', { name: 'View pricing details' })
    ).toBeVisible()
  })
})
