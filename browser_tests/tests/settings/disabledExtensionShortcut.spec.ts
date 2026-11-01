import type { GetExtensionsResponse } from '@comfyorg/ingest-types'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  DISABLED_SHORTCUT_EXTENSION,
  ENABLED_SHORTCUT_EXTENSION,
  SHORTCUT_PACK_SCRIPT,
  shortcutPackSource
} from '@e2e/fixtures/data/shortcutPackFixture'

test.use({
  initialSettings: { 'Comfy.Extension.Disabled': [DISABLED_SHORTCUT_EXTENSION] }
})

test.beforeEach(async ({ page }) => {
  await page.route('**/extensions', (route) =>
    route.fulfill({
      json: [SHORTCUT_PACK_SCRIPT] satisfies GetExtensionsResponse
    })
  )
  await page.route(`**${SHORTCUT_PACK_SCRIPT}*`, (route) =>
    route.fulfill({ contentType: 'text/javascript', body: shortcutPackSource })
  )
})

test.describe(
  'Disabled third-party extension shortcuts',
  { tag: ['@settings', '@keyboard'] },
  () => {
    test("a disabled extension's shortcut does nothing and is not listed", async ({
      comfyPage,
      page
    }) => {
      const body = page.locator('body')

      await test.step('Alt+J (disabled extension) does nothing', async () => {
        await comfyPage.canvas.click({ position: { x: 400, y: 400 } })
        await comfyPage.canvas.press('Alt+KeyJ')
        await comfyPage.nextFrame()
        await expect(body).not.toHaveAttribute('data-ran-shortcut')
      })

      await test.step('Alt+K (enabled extension) still runs', async () => {
        await comfyPage.canvas.press('Alt+KeyK')
        await expect(body).toHaveAttribute(
          'data-ran-shortcut',
          ENABLED_SHORTCUT_EXTENSION
        )
      })

      await test.step('Only the enabled shortcut is in Keybindings', async () => {
        const { keybindingPanel } = comfyPage.settingDialog
        await comfyPage.settingDialog.open()
        await comfyPage.settingDialog.category('Keybinding').click()
        await keybindingPanel.search('ShortcutPack')
        await expect(
          keybindingPanel.commandRow(`${ENABLED_SHORTCUT_EXTENSION}.Run`)
        ).toBeVisible()
        await expect(
          keybindingPanel.commandRow(`${DISABLED_SHORTCUT_EXTENSION}.Run`)
        ).toHaveCount(0)
      })
    })
  }
)
