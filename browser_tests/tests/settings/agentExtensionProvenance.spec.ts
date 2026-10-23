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

      await comfyPage.settingDialog.open()
      await comfyPage.settingDialog.category('Extension').click()
      await expect(page.getByText('Created by agent')).toBeVisible()
      await expect(page.getByText(/Adds cushion controls/)).toBeVisible()

      await page.getByRole('button', { name: 'Agent-created' }).click()
      await expect(
        page.getByRole('switch', { name: 'agent.cushions.toolbar' })
      ).toBeVisible()
      await expect(
        page.getByRole('switch', { name: 'Manual.Toolbar' })
      ).toBeHidden()
    })
  }
)
