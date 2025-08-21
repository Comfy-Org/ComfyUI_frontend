import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Menu', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
  })

  test('Can register sidebar tab', async ({ comfyPage }) => {
    const initialChildrenCount = await comfyPage.menu.sideToolbar.evaluate(
      (el) => el.children.length
    )

    await comfyPage.page.evaluate(async () => {
      window['app'].extensionManager.registerSidebarTab({
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
    await comfyPage.nextFrame()

    const newChildrenCount = await comfyPage.menu.sideToolbar.evaluate(
      (el) => el.children.length
    )
    expect(newChildrenCount).toBe(initialChildrenCount + 1)
  })

  test.describe('Workflows topbar tabs', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.setSetting(
        'Comfy.Workflow.WorkflowTabsPosition',
        'Topbar'
      )
      await comfyPage.setupWorkflowsDirectory({})
    })

    test('Can show opened workflows', async ({ comfyPage }) => {
      expect(await comfyPage.menu.topbar.getTabNames()).toEqual([
        'Unsaved Workflow'
      ])
    })

    test('Can close saved-workflow tabs', async ({ comfyPage }) => {
      const workflowName = `tempWorkflow-${test.info().title}`
      await comfyPage.menu.topbar.saveWorkflow(workflowName)
      expect(await comfyPage.menu.topbar.getTabNames()).toEqual([workflowName])
      await comfyPage.menu.topbar.closeWorkflowTab(workflowName)
      await comfyPage.nextFrame()
      expect(await comfyPage.menu.topbar.getTabNames()).toEqual([
        'Unsaved Workflow'
      ])
    })
  })

  test.describe('Topbar submmenus', () => {
    test('@mobile Items fully visible on mobile screen width', async ({
      comfyPage
    }) => {
      await comfyPage.menu.topbar.openTopbarMenu()
      const topLevelMenuItem = comfyPage.page
        .locator('a.p-menubar-item-link')
        .first()
      const isTextCutoff = await topLevelMenuItem.evaluate((el) => {
        return el.scrollWidth > el.clientWidth
      })
      expect(isTextCutoff).toBe(false)
    })

    test('Clicking on active state items does not close menu', async ({
      comfyPage
    }) => {
      // Open the menu
      await comfyPage.menu.topbar.openTopbarMenu()
      const menu = comfyPage.page.locator('.comfy-command-menu')

      // Navigate to View menu
      const viewMenuItem = comfyPage.page.locator(
        '.p-menubar-item-label:text-is("View")'
      )
      await viewMenuItem.hover()

      // Wait for submenu to appear
      const viewSubmenu = comfyPage.page
        .locator('.p-tieredmenu-submenu:visible')
        .first()
      await viewSubmenu.waitFor({ state: 'visible' })

      // Find Bottom Panel menu item
      const bottomPanelMenuItem = viewSubmenu
        .locator('.p-tieredmenu-item:has-text("Bottom Panel")')
        .first()
      const bottomPanelItem = bottomPanelMenuItem.locator(
        '.p-menubar-item-label:text-is("Bottom Panel")'
      )
      await bottomPanelItem.waitFor({ state: 'visible' })

      // Get checkmark icon element
      const checkmark = bottomPanelMenuItem.locator('.pi-check')

      // Check initial state of bottom panel (it's initially hidden)
      const bottomPanel = comfyPage.page.locator('.bottom-panel')
      await expect(bottomPanel).not.toBeVisible()

      // Checkmark should be invisible initially (panel is hidden)
      await expect(checkmark).toHaveClass(/invisible/)

      // Click Bottom Panel to toggle it on
      await bottomPanelItem.click()

      // Verify menu is still visible after clicking
      await expect(menu).toBeVisible()
      await expect(viewSubmenu).toBeVisible()

      // Verify bottom panel is now visible
      await expect(bottomPanel).toBeVisible()

      // Checkmark should now be visible (panel is shown)
      await expect(checkmark).not.toHaveClass(/invisible/)

      // Click Bottom Panel again to toggle it off
      await bottomPanelItem.click()

      // Verify menu is still visible after second click
      await expect(menu).toBeVisible()
      await expect(viewSubmenu).toBeVisible()

      // Verify bottom panel is hidden again
      await expect(bottomPanel).not.toBeVisible()

      // Checkmark should be invisible again (panel is hidden)
      await expect(checkmark).toHaveClass(/invisible/)

      // Click outside to close menu
      await comfyPage.page.locator('body').click({ position: { x: 10, y: 10 } })

      // Verify menu is now closed
      await expect(menu).not.toBeVisible()
    })

    test('Displays keybinding next to item', async ({ comfyPage }) => {
      await comfyPage.menu.topbar.openTopbarMenu()
      const workflowMenuItem = comfyPage.menu.topbar.getMenuItem('File')
      await workflowMenuItem.hover()
      const exportTag = comfyPage.page.locator('.keybinding-tag', {
        hasText: 'Ctrl + s'
      })
      expect(await exportTag.count()).toBe(1)
    })

    test('Can catch error when executing command', async ({ comfyPage }) => {
      await comfyPage.page.evaluate(() => {
        window['app'].registerExtension({
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
      expect(await comfyPage.getVisibleToastCount()).toBe(1)
    })

    test('Can navigate Theme menu and switch between Dark and Light themes', async ({
      comfyPage
    }) => {
      // Open the topbar menu
      await comfyPage.menu.topbar.openTopbarMenu()
      const menu = comfyPage.page.locator('.comfy-command-menu')
      await expect(menu).toBeVisible()

      // Navigate to Theme menu item and open its submenu
      const themeMenuItem = comfyPage.page.locator(
        '.p-menubar-item-label:text-is("Theme")'
      )
      await themeMenuItem.hover()

      // Wait for theme submenu to appear
      const themeSubmenu = comfyPage.page
        .locator('.p-tieredmenu-submenu:visible')
        .last()
      await themeSubmenu.waitFor({ state: 'visible' })

      // Verify that Dark (Default) and Light themes are available
      const darkThemeItem = themeSubmenu.locator(
        '.p-tieredmenu-item:has-text("Dark (Default)")'
      )
      const lightThemeItem = themeSubmenu.locator(
        '.p-tieredmenu-item:has-text("Light")'
      )

      await expect(darkThemeItem).toBeVisible()
      await expect(lightThemeItem).toBeVisible()

      // Click Light theme
      const lightThemeLabel = lightThemeItem.locator('.p-menubar-item-label')
      await lightThemeLabel.click()

      // Verify menu stays open and Light theme shows as active (has checkmark)
      await expect(menu).toBeVisible()
      await expect(themeSubmenu).toBeVisible()

      // Check for active state indicator (checkmark) on Light theme
      const lightCheckmark = lightThemeItem.locator('.pi-check')
      await expect(lightCheckmark).not.toHaveClass(/invisible/)

      // Verify ColorPalette setting is set to "light"
      expect(await comfyPage.getSetting('Comfy.ColorPalette')).toBe('light')

      // Click Dark (Default) theme
      const darkThemeLabel = darkThemeItem.locator('.p-menubar-item-label')
      await darkThemeLabel.click()

      // Verify menu stays open and Dark theme shows as active
      await expect(menu).toBeVisible()
      await expect(themeSubmenu).toBeVisible()

      // Check for active state indicator (checkmark) on Dark theme
      const darkCheckmark = darkThemeItem.locator('.pi-check')
      await expect(darkCheckmark).not.toHaveClass(/invisible/)

      // Light theme should no longer be active
      await expect(lightCheckmark).toHaveClass(/invisible/)

      // Verify ColorPalette setting is set to "dark"
      expect(await comfyPage.getSetting('Comfy.ColorPalette')).toBe('dark')

      // Close menu by clicking outside
      await comfyPage.page.locator('body').click({ position: { x: 10, y: 10 } })
      await expect(menu).not.toBeVisible()
    })
  })

  // Only test 'Top' to reduce test time.
  // ['Bottom', 'Top']
  ;['Top'].forEach(async (position) => {
    test(`Can migrate deprecated menu positions (${position})`, async ({
      comfyPage
    }) => {
      await comfyPage.setSetting('Comfy.UseNewMenu', position)
      expect(await comfyPage.getSetting('Comfy.UseNewMenu')).toBe('Top')
    })

    test(`Can migrate deprecated menu positions on initial load (${position})`, async ({
      comfyPage
    }) => {
      await comfyPage.setSetting('Comfy.UseNewMenu', position)
      await comfyPage.setup()
      expect(await comfyPage.getSetting('Comfy.UseNewMenu')).toBe('Top')
    })
  })
})
