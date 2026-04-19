import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('File input same-file reselection', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
    await comfyPage.settings.setSetting('Comfy.Canvas.BackgroundImage', '')
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.Canvas.BackgroundImage', '')
  })

  test('should allow uploading the same file twice in a row', async ({
    comfyPage
  }) => {
    await comfyPage.page.keyboard.press('Control+,')

    const appearanceOption = comfyPage.page.locator('text=Appearance')
    await appearanceOption.click()

    const backgroundImageSetting = comfyPage.page.locator(
      '#Comfy\\.Canvas\\.BackgroundImage'
    )
    const uploadButton = backgroundImageSetting.getByRole('button', {
      name: /upload/i
    })

    const firstChooser = comfyPage.page.waitForEvent('filechooser')
    await uploadButton.click()
    await (
      await firstChooser
    ).setFiles(comfyPage.assetPath('test_upload_image.png'))

    const urlInput = backgroundImageSetting.getByRole('textbox')
    await expect(urlInput).toHaveValue(/^\/api\/view\?/)

    const clearButton = backgroundImageSetting.getByRole('button', {
      name: /clear/i
    })
    await clearButton.click()
    await expect(urlInput).toHaveValue('')

    // Second upload of the SAME file — this failed before the fix because
    // the hidden input retained the previous value and onchange did not fire.
    const secondChooser = comfyPage.page.waitForEvent('filechooser')
    await uploadButton.click()
    await (
      await secondChooser
    ).setFiles(comfyPage.assetPath('test_upload_image.png'))

    await expect(urlInput).toHaveValue(/^\/api\/view\?/)
  })
})
