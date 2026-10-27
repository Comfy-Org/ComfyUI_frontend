import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'Agent-created extension provenance',
  { tag: '@settings' },
  () => {
    test('shows agent attribution and filters the extension list', async ({
      comfyPage,
      page
    }) => {
      await page.evaluate(() => {
        window.app!.registerExtension({ name: 'Manual.Toolbar' })
        window.app!.registerExtension({
          name: 'agent.cushions.toolbar',
          provenance: {
            createdBy: 'comfy-agent',
            summary: 'Adds cushion controls'
          }
        })
      })

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
        await comfyPage.contextMenu
          .menuItem('Disable all agent-created')
          .click()
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

    test('disables the bulk action when every agent extension is read-only', async ({
      comfyPage,
      page
    }) => {
      await page.evaluate(() => {
        window.app!.registerExtension({
          name: 'pysssss.Locking',
          provenance: { createdBy: 'comfy-agent' }
        })
      })

      await comfyPage.settingDialog.open()
      await comfyPage.settingDialog.category('Extension').click()
      await comfyPage.settingDialog.openExtensionActions()
      await expect(
        comfyPage.contextMenu.menuItem('Disable all agent-created')
      ).toBeDisabled()
    })
  }
)
