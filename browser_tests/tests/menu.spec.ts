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

    test('Browse Templates custom icon is visible and matches sidebar icon', async ({
      comfyPage
    }) => {
      // Open the top menu
      await comfyPage.menu.topbar.openTopbarMenu()
      const menu = comfyPage.page.locator('.comfy-command-menu')

      // Find the Browse Templates menu item
      const browseTemplatesItem = menu.locator(
        '.p-menubar-item-label:text-is("Browse Templates")'
      )
      await expect(browseTemplatesItem).toBeVisible()

      // Check that the Browse Templates item has an icon
      const menuIcon = browseTemplatesItem
        .locator('..')
        .locator('.p-menubar-item-icon')
        .first()
      await expect(menuIcon).toBeVisible()

      // Get the icon's tag name and class to verify it's a component (not a string icon)
      const menuIconType = await menuIcon.evaluate((el) => {
        // If it's a Vue component, it will not have pi/mdi classes
        // and should be an SVG or custom component
        const tagName = el.tagName.toLowerCase()
        const classes = el.className || ''
        return {
          tagName,
          classes,
          hasStringIcon:
            typeof classes === 'string' &&
            (classes.includes('pi ') || classes.includes('mdi '))
        }
      })

      // Verify it's a component icon (not a string icon with pi/mdi classes)
      expect(menuIconType.hasStringIcon).toBe(false)

      // Close menu
      await comfyPage.page.locator('body').click({ position: { x: 10, y: 10 } })

      // Now check the sidebar templates button
      const sidebarTemplatesButton = comfyPage.page.locator(
        '.templates-tab-button'
      )
      await expect(sidebarTemplatesButton).toBeVisible()

      // Get the sidebar icon info
      const sidebarIcon = sidebarTemplatesButton.locator(
        '.side-bar-button-icon'
      )
      await expect(sidebarIcon).toBeVisible()

      const sidebarIconType = await sidebarIcon.evaluate((el) => {
        const tagName = el.tagName.toLowerCase()
        const classes = el.className || ''
        return {
          tagName,
          classes,
          hasStringIcon:
            typeof classes === 'string' &&
            (classes.includes('pi ') || classes.includes('mdi '))
        }
      })

      // Verify sidebar also uses component icon (not string icon)
      expect(sidebarIconType.hasStringIcon).toBe(false)

      // Both should be using the same custom component (likely SVG elements)
      expect(menuIconType.tagName).toBe('svg')
      expect(sidebarIconType.tagName).toBe('svg')
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
