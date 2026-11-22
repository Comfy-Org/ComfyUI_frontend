import type { GetExtensionsResponse } from '@comfyorg/ingest-types'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

const PACK_SWITCH = 'Extension folder agent-cushions'

test.beforeEach(async ({ page }) => {
  await page.route('**/extensions', (route) =>
    route.fulfill({
      json: [
        '/extensions/agent-cushions/main.js'
      ] satisfies GetExtensionsResponse
    })
  )
  await page.route('**/extensions/agent-cushions/main.js*', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: '' })
  )
})

test.describe(
  'Extension pack save failure',
  { tag: ['@settings', '@ui'] },
  () => {
    test('returns the switch only when the server proves it refused the save', async ({
      comfyPage,
      page
    }) => {
      await page.route('**/settings/Comfy.Extension.DisabledPacks', (route) =>
        route.request().method() === 'POST'
          ? route.fulfill({ status: 400, body: 'Bad Request' })
          : route.fallback()
      )

      const dialog = comfyPage.settingDialog
      const packSwitch = dialog.root.getByRole('switch', { name: PACK_SWITCH })

      await test.step('Open extension pack settings', async () => {
        await dialog.open()
        await dialog.category('Extension').click()
        await expect(packSwitch).toBeChecked()
      })

      await test.step('Reject the save and retain pack enablement', async () => {
        await packSwitch.click()

        await expect(
          comfyPage.toast.withText('The extension change was not saved')
        ).toBeVisible()
        await expect(packSwitch).toBeChecked()
        await expect(
          dialog.root.getByRole('button', { name: 'Reload to apply changes' })
        ).toBeHidden()
      })
    })

    test('keeps the switch off when the save result is indeterminate', async ({
      comfyPage,
      page
    }) => {
      await page.route('**/settings/Comfy.Extension.DisabledPacks', (route) =>
        route.request().method() === 'POST'
          ? route.fulfill({ status: 500, body: 'Server Error' })
          : route.fallback()
      )

      const dialog = comfyPage.settingDialog
      const packSwitch = dialog.root.getByRole('switch', { name: PACK_SWITCH })

      await test.step('Open extension pack settings', async () => {
        await dialog.open()
        await dialog.category('Extension').click()
        await expect(packSwitch).toBeChecked()
      })

      await test.step('Keep the optimistic change until reload confirms it', async () => {
        await packSwitch.click()

        await expect(
          comfyPage.toast.withText(
            'The extension change could not be confirmed'
          )
        ).toBeVisible()
        await expect(packSwitch).not.toBeChecked()
        await expect(
          dialog.root.getByRole('button', { name: 'Reload to apply changes' })
        ).toBeVisible()
      })
    })
  }
)
