import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

const PACK_SWITCH = 'Extension pack agent-cushions'

test.beforeEach(async ({ page }) => {
  await page.route('**/extensions', (route) =>
    route.fulfill({ json: ['/extensions/agent-cushions/main.js'] })
  )
  await page.route('**/extensions/agent-cushions/main.js*', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: '' })
  )
})

test.describe(
  'Extension pack save failure',
  { tag: ['@settings', '@ui'] },
  () => {
    test('tells the user and returns the switch when the server refuses the save', async ({
      comfyPage,
      page
    }) => {
      await page.route('**/settings/Comfy.Extension.DisabledPacks', (route) =>
        route.request().method() === 'POST'
          ? route.fulfill({ status: 500, body: 'Server Error' })
          : route.fallback()
      )

      const dialog = comfyPage.settingDialog
      await dialog.open()
      await dialog.category('Extension').click()

      const packSwitch = dialog.root.getByRole('switch', { name: PACK_SWITCH })
      await expect(packSwitch).toBeChecked()

      await packSwitch.click()

      await expect(
        comfyPage.toast.withText(/Comfy\.Extension\.DisabledPacks/)
      ).toBeVisible()
      await expect(packSwitch).toBeChecked()
      await expect(
        dialog.root.getByRole('button', { name: 'Reload to apply changes' })
      ).toBeHidden()
    })
  }
)
