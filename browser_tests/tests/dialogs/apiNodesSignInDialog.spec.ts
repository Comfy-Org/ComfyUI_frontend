import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { ApiSignin } from '@e2e/fixtures/components/ApiSignin'

test.describe('API Nodes sign-in dialog', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
  })

  test('lists the requested API nodes and resolves false on cancel', async ({
    comfyPage
  }) => {
    const dialog = new ApiSignin(comfyPage.page)
    const { result: dialogResult } = await dialog.open([
      'FluxProGenerate',
      'StableDiffusion3Generate'
    ])

    await expect(dialog.root.getByText('FluxProGenerate')).toBeVisible()
    await expect(
      dialog.root.getByText('StableDiffusion3Generate')
    ).toBeVisible()

    await dialog.cancel.click()
    await expect(dialog.root).toBeHidden()
    expect(await dialogResult).toBe(false)
  })
})
