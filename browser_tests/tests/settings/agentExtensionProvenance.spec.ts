import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { Request } from '@playwright/test'

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
    })

    test('preserves an agent disable when another extension is disabled before it settles', async ({
      comfyPage,
      page
    }) => {
      let batchRequest: Request | undefined
      let nameRequest: Request | undefined
      let acceptBatch = () => {}
      let acceptName = () => {}
      const batchAccepted = new Promise<void>((resolve) => {
        acceptBatch = resolve
      })
      const nameAccepted = new Promise<void>((resolve) => {
        acceptName = resolve
      })

      await page.route('**/settings', async (route) => {
        if (route.request().method() !== 'POST') return route.fallback()
        batchRequest = route.request()
        await batchAccepted
        await route.fulfill({ status: 200 })
      })
      await page.route(
        '**/settings/Comfy.Extension.Disabled',
        async (route) => {
          if (route.request().method() !== 'POST') return route.fallback()
          nameRequest = route.request()
          await nameAccepted
          await route.fulfill({ status: 200 })
        }
      )
      await page.evaluate(() => {
        window.app!.registerExtension({ name: 'Manual.Toolbar' })
        window.app!.registerExtension({ name: 'agent.standalone.toolbar' })
      })

      try {
        const dialog = comfyPage.settingDialog
        await dialog.open()
        await dialog.category('Extension').click()

        await dialog.openExtensionActions()
        await comfyPage.contextMenu
          .menuItem('Disable all agent-created')
          .click()
        await expect.poll(() => batchRequest).toBeDefined()

        await dialog.root
          .getByRole('switch', { name: 'Manual.Toolbar' })
          .click()
        acceptBatch()
        await expect.poll(() => nameRequest).toBeDefined()

        expect(batchRequest!.postDataJSON()).toEqual({
          'Comfy.Extension.Disabled': ['agent.standalone.toolbar'],
          'Comfy.Extension.DisabledPacks': []
        })
        expect(nameRequest!.postDataJSON()).toEqual([
          'agent.standalone.toolbar',
          'Manual.Toolbar'
        ])
        await expect(
          dialog.root.getByRole('button', {
            name: 'Reload to apply changes'
          })
        ).toBeDisabled()

        acceptName()
        await expect(
          dialog.root.getByRole('button', {
            name: 'Reload to apply changes'
          })
        ).toBeEnabled()
      } finally {
        acceptBatch()
        acceptName()
      }
    })
  }
)
