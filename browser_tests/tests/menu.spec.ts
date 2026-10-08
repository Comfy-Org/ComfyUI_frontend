import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Menu', { tag: '@ui' }, () => {
  test('Can register sidebar tab', async ({ comfyPage }) => {
    const initialChildrenCount = await comfyPage.menu.buttons.count()

    await comfyPage.page.evaluate(async () => {
      window.app!.extensionManager.registerSidebarTab({
        id: 'search',
        icon: 'pi pi-search',
        title: 'search',
        tooltip: 'search',
        type: 'custom',
        render: (el) => {
          el.innerHTML = '<div>Custom search tab</div>'
        }
      })
    })
    await expect(comfyPage.menu.buttons).toHaveCount(initialChildrenCount + 1)
  })

  test.describe('Workflows topbar tabs', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.setupWorkflowsDirectory({})
    })

    test('Can show opened workflows', async ({ comfyPage }) => {
      await expect
        .poll(() => comfyPage.menu.topbar.getTabNames())
        .toEqual(['Unsaved Workflow'])
    })

    test('Can close saved-workflow tabs', async ({ comfyPage }) => {
      const workflowName = `tempWorkflow-${test.info().title}`
      await comfyPage.menu.topbar.saveWorkflow(workflowName)
      await expect
        .poll(() => comfyPage.menu.topbar.getTabNames())
        .toEqual([workflowName])
      await comfyPage.menu.topbar.closeWorkflowTab(workflowName)
      await expect
        .poll(() => comfyPage.menu.topbar.getTabNames())
        .toEqual(['Unsaved Workflow'])
    })

    test('An outside click dismisses the menu and switches workflow', async ({
      comfyPage
    }) => {
      const { topbar } = comfyPage.menu
      const workflowName = `tempWorkflow-${test.info().title}`
      await topbar.saveWorkflow(workflowName)
      await topbar.newWorkflowButton.click()
      await expect(topbar.getActiveTab()).toContainText('Unsaved Workflow')
      const menu = await topbar.openTopbarMenu()

      await topbar.getWorkflowTab(workflowName).click()

      await expect(menu).toBeHidden()
      await expect(topbar.getActiveTab()).toContainText(workflowName)
    })
  })

  test.describe('Topbar submmenus', () => {
    test('@mobile Items fully visible on mobile screen width', async ({
      comfyPage
    }) => {
      const menu = await comfyPage.menu.topbar.openTopbarMenu()
      const topLevelMenuItem = menu.getByRole('menuitem').first()
      await expect
        .poll(() =>
          topLevelMenuItem.evaluate((el) => el.scrollWidth > el.clientWidth)
        )
        .toBe(false)
    })

    test('Clicking on active state items does not close menu', async ({
      comfyPage
    }) => {
      const { topbar } = comfyPage.menu
      const menu = await topbar.openTopbarMenu()
      const viewSubmenu = await topbar.openSubmenu('View')
      const bottomPanelItem = topbar.getMenuItem('Bottom Panel', viewSubmenu)
      const { bottomPanel } = comfyPage
      await expect(bottomPanel.root).toBeHidden()
      await expect(bottomPanelItem).not.toBeChecked()

      await test.step('Show the panel without closing the menu', async () => {
        await bottomPanelItem.click()
        await expect(bottomPanel.root).toBeVisible()
        await expect(bottomPanelItem).toBeChecked()
        await expect(menu).toBeVisible()
        await expect(viewSubmenu).toBeVisible()
      })

      await test.step('Hide the panel without closing the menu', async () => {
        await bottomPanelItem.click()
        await expect(bottomPanel.root).toBeHidden()
        await expect(bottomPanelItem).not.toBeChecked()
        await expect(menu).toBeVisible()
        await expect(viewSubmenu).toBeVisible()
      })

      await topbar.closeTopbarMenu()
      await expect(menu).toBeHidden()
    })

    test('Displays keybinding next to item', async ({ comfyPage }) => {
      await comfyPage.menu.topbar.openTopbarMenu()
      const workflowMenuItem = comfyPage.menu.topbar.getMenuItem('File')
      await workflowMenuItem.hover()
      const exportTag = comfyPage.menu.topbar
        .getVisibleSubmenu()
        .getByRole('menuitem', { name: 'Save', exact: true })
        .getByText('Ctrl + s', { exact: true })
      await expect(exportTag).toHaveCount(1)
    })

    test('Can catch error when executing command', async ({ comfyPage }) => {
      await comfyPage.page.evaluate(() => {
        window.app!.registerExtension({
          name: 'TestExtension1',
          commands: [
            {
              id: 'foo',
              label: 'foo-command',
              function: () => {
                throw new Error('foo!')
              }
            }
          ],
          menuCommands: [
            {
              path: ['ext'],
              commands: ['foo']
            }
          ]
        })
      })
      await comfyPage.menu.topbar.triggerTopbarCommand(['ext', 'foo-command'])
      await expect(comfyPage.toast.visibleToasts).toHaveCount(1)
    })

    test('Can navigate Theme menu and switch between Dark and Light themes', async ({
      comfyPage
    }) => {
      const { topbar } = comfyPage.menu

      // Take initial screenshot with default theme
      await comfyPage.attachScreenshot('theme-initial')

      // Open the topbar menu
      const menu = await topbar.openTopbarMenu()
      await expect(menu).toBeVisible()

      // Get theme menu items
      const {
        submenu: themeSubmenu,
        darkTheme: darkThemeItem,
        lightTheme: lightThemeItem
      } = await topbar.getThemeMenuItems()

      await expect(darkThemeItem).toBeVisible()
      await expect(lightThemeItem).toBeVisible()

      // Switch to Light theme
      await topbar.switchTheme('light')

      // Verify menu stays open and Light theme shows as active
      await expect(async () => {
        await expect(menu).toBeVisible()
        await expect(themeSubmenu).toBeVisible()
        await expect(
          lightThemeItem.getByTestId('menu-item-indicator')
        ).not.toHaveClass(/invisible/)
      }).toPass({ timeout: 5000 })

      // Screenshot with light theme active
      await comfyPage.attachScreenshot('theme-menu-light-active')

      // Verify ColorPalette setting is set to "light"
      await expect
        .poll(() => comfyPage.settings.getSetting('Comfy.ColorPalette'))
        .toBe('light')

      // Close menu to see theme change
      await topbar.closeTopbarMenu()

      // Re-open menu and get theme items again
      await topbar.openTopbarMenu()
      const themeItems2 = await topbar.getThemeMenuItems()

      // Switch back to Dark theme
      await topbar.switchTheme('dark')

      // Verify menu stays open and Dark theme shows as active
      await expect(async () => {
        await expect(menu).toBeVisible()
        await expect(themeItems2.submenu).toBeVisible()
        await expect(
          themeItems2.darkTheme.getByTestId('menu-item-indicator')
        ).not.toHaveClass(/invisible/)
        await expect(
          themeItems2.lightTheme.getByTestId('menu-item-indicator')
        ).toHaveClass(/invisible/)
      }).toPass({ timeout: 5000 })

      // Screenshot with dark theme active
      await comfyPage.attachScreenshot('theme-menu-dark-active')

      // Verify ColorPalette setting is set to "dark"
      await expect
        .poll(() => comfyPage.settings.getSetting('Comfy.ColorPalette'))
        .toBe('dark')

      // Close menu
      await topbar.closeTopbarMenu()
    })
  })

  test('Toggles the focused Nodes 2.0 row with Enter and Space', async ({
    comfyPage
  }) => {
    const { topbar } = comfyPage.menu
    await topbar.openTopbarMenu()
    const nodes2Toggle = comfyPage.page.getByRole('menuitemcheckbox', {
      name: 'Nodes 2.0'
    })

    await topbar.menuRoot.focus()
    await comfyPage.page.keyboard.press('n')
    await expect
      .poll(() => comfyPage.settings.getSetting('Comfy.VueNodes.Enabled'))
      .toBe(false)

    await topbar.focusMenuItem('Nodes 2.0')

    await comfyPage.page.keyboard.press('Enter')
    await expect
      .poll(() => comfyPage.settings.getSetting('Comfy.VueNodes.Enabled'))
      .toBe(true)
    await expect(nodes2Toggle).toBeChecked()

    await comfyPage.page.keyboard.press('Space')
    await expect
      .poll(() => comfyPage.settings.getSetting('Comfy.VueNodes.Enabled'))
      .toBe(false)
    await expect(nodes2Toggle).not.toBeChecked()
  })

  // Only test 'Top' to reduce test time.
  // ['Bottom', 'Top']
  ;['Top'].forEach(async (position) => {
    test(`Can migrate deprecated menu positions (${position})`, async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', position)
      await expect
        .poll(() => comfyPage.settings.getSetting('Comfy.UseNewMenu'))
        .toBe('Top')
    })

    test(`Can migrate deprecated menu positions on initial load (${position})`, async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', position)
      // oxlint-disable-next-line comfy/no-comfy-page-setup-call -- pre-existing call, migration tracked in #16859; not fixed in this pass
      await comfyPage.setup()
      await expect
        .poll(() => comfyPage.settings.getSetting('Comfy.UseNewMenu'))
        .toBe('Top')
    })
  })
})
