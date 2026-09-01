import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { UpdatePassword } from '@e2e/fixtures/components/UpdatePassword'

test.describe('Update password dialog', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
  })

  test('Should only allow submission when inputs are valid', async ({
    comfyPage
  }) => {
    const dialog = new UpdatePassword(comfyPage.page)
    await dialog.open()

    await dialog.confirm.click()
    await expect(dialog.root, 'Check that password exists').toBeVisible()

    const testPassword = 'Unguessable Password #2'
    await dialog.password.fill(testPassword)

    await dialog.confirm.click()
    await expect(dialog.root, 'Check that inputs match').toBeVisible()

    await dialog.confirmPassword.fill(testPassword)
    await dialog.confirm.click()
    await expect(dialog.root, 'Dialog closes after submission').toBeHidden()
  })
})
