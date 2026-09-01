import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { CloudNotification } from '@e2e/fixtures/components/CloudNotification'

test.describe('Cloud notification dialog', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
  })

  test('Should display cloud notification and navigate to comfy.org on Explore', async ({
    comfyPage
  }) => {
    const dialog = new CloudNotification(comfyPage.page)
    await dialog.open()

    await expect(
      dialog.root.getByText('Run ComfyUI in the Cloud')
    ).toBeVisible()

    const popupPromise = comfyPage.page.waitForEvent('popup')
    await dialog.toCloud.click()
    const popup = await popupPromise

    expect(new URL(popup.url()).hostname).toContain('comfy.org')
    await popup.close()
    await expect(dialog.root).toBeHidden()
  })

  test('Should close when Continue Locally is clicked', async ({
    comfyPage
  }) => {
    const dialog = new CloudNotification(comfyPage.page)
    await dialog.open()

    await dialog.back.click()
    await expect(dialog.root).toBeHidden()
  })

  test('Should not advertise free monthly credits', async ({ comfyPage }) => {
    const dialog = new CloudNotification(comfyPage.page)
    await dialog.open()

    await expect(dialog.root.getByText(/Free Credits/i)).toHaveCount(0)
    await expect(dialog.root.getByText(/400/)).toHaveCount(0)
  })
})
