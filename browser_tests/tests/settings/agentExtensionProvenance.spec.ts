import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { expectElementScreenshot } from '@e2e/fixtures/utils/screenshotRegion'
import type { WorkspaceStore } from '@e2e/types/globals'

test.describe(
  'Agent-created extension provenance',
  { tag: '@settings' },
  () => {
    test(
      'shows agent attribution and filters the extension list',
      {
        tag: '@screenshot'
      },
      async ({ comfyPage, page }) => {
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
          await expect(
            comfyPage.settingDialog.contentArea.getByText(
              /Adds cushion controls/
            )
          ).toBeVisible()
        })

        await test.step('Show only agent-created extensions', async () => {
          await page.getByRole('button', { name: 'Agent-created' }).click()
          await expect(
            page.getByRole('switch', { name: 'agent.cushions.toolbar' })
          ).toBeVisible()
          await expect(
            page.getByRole('switch', { name: 'Manual.Toolbar' })
          ).toBeHidden()
          await expectElementScreenshot(
            comfyPage.settingDialog.contentArea,
            'agent-extensions-filtered.png'
          )
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
      }
    )

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

    test('announces a newly registered agent extension with both actions', async ({
      comfyPage,
      page
    }) => {
      await page.evaluate(() => {
        window.app!.registerExtension({
          name: 'agent.cushions.notices',
          provenance: {
            createdBy: 'comfy-agent',
            summary: 'Adds cushion controls'
          }
        })
      })

      const notice = comfyPage.toast.withText(
        'Your agent added agent.cushions.notices'
      )
      await expect(notice).toBeVisible()
      await expect(notice).toContainText('Adds cushion controls')
      await expect(
        notice.getByRole('button', { name: 'Disable extension' })
      ).toBeVisible()

      await notice.getByRole('button', { name: 'Manage extensions' }).click()
      await expect(comfyPage.settingDialog.root).toBeVisible()
      await expect(
        comfyPage.settingDialog.contentArea.getByRole('switch', {
          name: 'agent.cushions.notices'
        })
      ).toBeVisible()
      await expect
        .poll(() =>
          comfyPage.settings.getPersistedSetting<string[]>(
            'Comfy.Extension.SeenAgentExtensions'
          )
        )
        .toContain('agent.cushions.notices')
    })

    test('routes an already-open Settings dialog to the extension controls', async ({
      comfyPage,
      page
    }) => {
      await test.step('Open Settings on another panel first', async () => {
        await comfyPage.settingDialog.open()
        await comfyPage.settingDialog.goToAboutPanel()
      })

      await page.evaluate(() => {
        window.app!.registerExtension({
          name: 'agent.cushions.routing',
          provenance: {
            createdBy: 'comfy-agent',
            summary: 'Adds cushion controls'
          }
        })
      })

      const notice = comfyPage.toast.withText(
        'Your agent added agent.cushions.routing'
      )
      await notice.getByRole('button', { name: 'Manage extensions' }).click()

      await expect(
        comfyPage.settingDialog.contentArea.getByRole('switch', {
          name: 'agent.cushions.routing'
        })
      ).toBeVisible()
      await expect(page.locator('.about-container')).toBeHidden()

      await test.step('Route back after the user navigates away again', async () => {
        await comfyPage.settingDialog.goToAboutPanel()
        await expect(page.locator('.about-container')).toBeVisible()

        await page.evaluate(() => {
          window.app!.registerExtension({
            name: 'agent.cushions.rerouting',
            provenance: { createdBy: 'comfy-agent' }
          })
        })
        await comfyPage.toast
          .withText('Your agent added agent.cushions.rerouting')
          .getByRole('button', { name: 'Manage extensions' })
          .click()

        await expect(
          comfyPage.settingDialog.contentArea.getByRole('switch', {
            name: 'agent.cushions.rerouting'
          })
        ).toBeVisible()
        await expect(page.locator('.about-container')).toBeHidden()
      })
    })

    test('badges an attributed sidebar tab without covering its count', async ({
      comfyPage,
      page
    }) => {
      await page.evaluate(() => {
        const name = 'agent.cushions.sidebar'
        window.app!.registerExtension({ name })
        const workspace = window.app!.extensionManager as WorkspaceStore
        workspace.sidebarTab.registerSidebarTab(
          {
            id: 'agent-cushions',
            icon: 'icon-[lucide--panel-left]',
            iconBadge: '123',
            title: 'Agent cushions',
            type: 'vue',
            component: {}
          },
          undefined,
          name
        )
      })

      const tab = page.getByTestId('agent-cushions-tab-button')
      await expect(tab).toHaveAccessibleName('Agent cushions (Agent-created)')

      await test.step('Keep both badges separate in the normal sidebar', async () => {
        await comfyPage.settings.setSetting('Comfy.Sidebar.Size', 'normal')
        await expect(async () => {
          const count = await tab.getByText('123').boundingBox()
          const provenance = await tab.getByText('AI').boundingBox()
          expect(count).not.toBeNull()
          expect(provenance).not.toBeNull()
          expect(
            count!.x + count!.width <= provenance!.x ||
              provenance!.x + provenance!.width <= count!.x ||
              count!.y + count!.height <= provenance!.y ||
              provenance!.y + provenance!.height <= count!.y
          ).toBe(true)
        }).toPass({ timeout: 5_000 })
      })

      await test.step('Keep both badges separate in the small sidebar', async () => {
        await comfyPage.settings.setSetting('Comfy.Sidebar.Size', 'small')
        await expect(async () => {
          const count = await tab.getByText('123').boundingBox()
          const provenance = await tab.getByText('AI').boundingBox()
          expect(count).not.toBeNull()
          expect(provenance).not.toBeNull()
          expect(
            count!.x + count!.width <= provenance!.x ||
              provenance!.x + provenance!.width <= count!.x ||
              count!.y + count!.height <= provenance!.y ||
              provenance!.y + provenance!.height <= count!.y
          ).toBe(true)
        }).toPass({ timeout: 5_000 })
      })

      await test.step('Open the agent extension menu', async () => {
        await page.route('**/api/settings/Comfy.Extension.Disabled', (route) =>
          route.request().method() === 'POST'
            ? route.fulfill({ status: 403 })
            : route.fallback()
        )
        await comfyPage.contextMenu.openFor(tab)
        await expect(
          comfyPage.contextMenu.menuItem('Manage extensions')
        ).toBeVisible()
        await expect(
          comfyPage.contextMenu.menuItem('Disable extension')
        ).toBeVisible()
      })

      await test.step('Keep the page open when the disable is refused', async () => {
        await comfyPage.contextMenu.menuItem('Disable extension').click()
        await expect(tab).toBeVisible()
        await expect(
          comfyPage.toast.withText("Couldn't disable the extension. Try again.")
        ).toBeVisible()
      })
    })
  }
)
