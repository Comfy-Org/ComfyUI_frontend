import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

const EXTENSION = 'Manual.Toolbar'

test.describe(
  'Extension disable save failure',
  { tag: ['@settings', '@ui'] },
  () => {
    test('tells the user and returns the switch when the server refuses the save', async ({
      comfyPage,
      page
    }) => {
      await page.route('**/settings/Comfy.Extension.Disabled', (route) =>
        route.request().method() === 'POST'
          ? route.fulfill({ status: 500, body: 'Server Error' })
          : route.fallback()
      )
      await page.evaluate((name) => {
        window.app!.registerExtension({ name })
      }, EXTENSION)

      const dialog = comfyPage.settingDialog

      await test.step('Open the Extensions panel', async () => {
        await dialog.open()
        await dialog.category('Extension').click()
      })

      const extensionSwitch = dialog.root.getByRole('switch', {
        name: EXTENSION
      })

      await test.step('The extension starts enabled', async () => {
        await expect(extensionSwitch).toBeChecked()
      })

      await test.step('Disabling it is reported, not silently dropped', async () => {
        await extensionSwitch.click()

        await expect(
          comfyPage.toast.withText(/Comfy\.Extension\.Disabled\b/)
        ).toBeVisible()
      })

      await test.step('The switch returns to the state the backend holds', async () => {
        await expect(extensionSwitch).toBeChecked()
        await expect(
          dialog.root.getByRole('button', { name: 'Reload to apply changes' })
        ).toBeHidden()
      })
    })
  }
)
