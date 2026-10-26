import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { expectRegionScreenshot } from '@e2e/fixtures/utils/screenshotRegion'

test.describe(
  'Agent-created extension provenance',
  { tag: ['@settings', '@screenshot'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.page.evaluate(() => {
        window.app!.registerExtension({ name: 'Manual.Toolbar' })
        window.app!.registerExtension({
          name: 'agent.cushions.toolbar',
          provenance: {
            createdBy: 'comfy-agent',
            summary: 'Adds cushion controls'
          }
        })
      })
    })

    test('shows agent attribution and filters the extension list', async ({
      comfyPage,
      page
    }) => {
      await test.step('Open Extensions and see agent attribution', async () => {
        await comfyPage.settingDialog.open()
        await comfyPage.settingDialog.category('Extension').click()
        await expect(page.getByText('Created by agent')).toBeVisible()
        await expect(page.getByText(/Adds cushion controls/)).toBeVisible()
      })

      await test.step('Show only agent-created extensions', async () => {
        await page.getByRole('button', { name: 'Agent-created' }).click()
        await expect(
          page.getByRole('switch', { name: 'agent.cushions.toolbar' })
        ).toBeVisible()
        await expect(
          page.getByRole('switch', { name: 'Manual.Toolbar' })
        ).toBeHidden()
      })

      await test.step('Disable every agent-created extension', async () => {
        const dialog = comfyPage.settingDialog
        await dialog.openExtensionActions()
        await expectRegionScreenshot(
          page,
          [dialog.root, comfyPage.contextMenu.ariaMenu],
          'agent-extension-provenance.png'
        )
        await comfyPage.contextMenu.clickMenuItemExact(
          'Disable all agent-created'
        )
        await expect(
          dialog.root.getByRole('switch', { name: 'agent.cushions.toolbar' })
        ).not.toBeChecked()
        await expect(
          dialog.root.getByRole('button', { name: 'Reload to apply changes' })
        ).toBeVisible()
        await expect
          .poll(() =>
            comfyPage.settings.getPersistedSetting<string[]>(
              'Comfy.Extension.Disabled'
            )
          )
          .toContain('agent.cushions.toolbar')
        await dialog.root.getByRole('button', { name: 'All' }).click()
        await expect(
          dialog.root.getByRole('switch', { name: 'Manual.Toolbar' })
        ).toBeChecked()
      })
    })
  }
)
