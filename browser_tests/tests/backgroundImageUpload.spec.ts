import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
})

test.describe('Background Image Upload', () => {
  test.beforeEach(async ({ comfyPage }) => {
    // Reset the background image setting before each test
    await comfyPage.settings.setSetting('Comfy.Canvas.BackgroundImage', '')
  })

  test.afterEach(async ({ comfyPage }) => {
    // Clean up background image setting after each test
    await comfyPage.settings.setSetting('Comfy.Canvas.BackgroundImage', '')
  })

  async function openBackgroundImageSetting(comfyPage: ComfyPage) {
    await comfyPage.page.keyboard.press('Control+,')
    await comfyPage.page.locator('text=Appearance').click()
    return comfyPage.page.locator('#Comfy\\.Canvas\\.BackgroundImage')
  }

  test('should show background image upload component in settings', async ({
    comfyPage
  }) => {
    const backgroundImageSetting = await openBackgroundImageSetting(comfyPage)
    await expect(backgroundImageSetting).toBeVisible()

    // With no image set: placeholder shown, no remove button
    await expect(backgroundImageSetting.getByText('Choose image')).toBeVisible()
    await expect(
      backgroundImageSetting.getByRole('button', { name: 'Remove image' })
    ).toBeHidden()
  })

  test('should upload image file and set as background', async ({
    comfyPage
  }) => {
    const backgroundImageSetting = await openBackgroundImageSetting(comfyPage)

    // Clicking the row opens the system file browser
    const fileChooserPromise = comfyPage.page.waitForEvent('filechooser')
    await backgroundImageSetting
      .getByRole('button', { name: 'Choose image' })
      .click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(comfyPage.assetPath('image32x32.webp'))

    // The row shows the uploaded file's base name and a remove button
    await expect(
      backgroundImageSetting.getByText('image32x32.webp')
    ).toBeVisible()
    await expect(
      backgroundImageSetting.getByRole('button', { name: 'Remove image' })
    ).toBeVisible()

    // The setting value points at the uploaded file
    const settingValue = await comfyPage.settings.getSetting(
      'Comfy.Canvas.BackgroundImage'
    )
    expect(settingValue).toMatch(/^\/api\/view\?.*subfolder=backgrounds/)
  })

  test('should show the base name of an existing background image', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting(
      'Comfy.Canvas.BackgroundImage',
      '/api/view?filename=backgrounds%2Ftest-image.png&type=input&subfolder=backgrounds'
    )

    const backgroundImageSetting = await openBackgroundImageSetting(comfyPage)
    await expect(
      backgroundImageSetting.getByText('test-image.png')
    ).toBeVisible()
  })

  test('should clear background image with the remove button', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting(
      'Comfy.Canvas.BackgroundImage',
      '/api/view?filename=test-image.png&type=input'
    )

    const backgroundImageSetting = await openBackgroundImageSetting(comfyPage)
    await backgroundImageSetting
      .getByRole('button', { name: 'Remove image' })
      .click()

    // Placeholder returns, remove button disappears, setting cleared
    await expect(backgroundImageSetting.getByText('Choose image')).toBeVisible()
    await expect(
      backgroundImageSetting.getByRole('button', { name: 'Remove image' })
    ).toBeHidden()
    await expect
      .poll(() => comfyPage.settings.getSetting('Comfy.Canvas.BackgroundImage'))
      .toBe('')
  })
})
