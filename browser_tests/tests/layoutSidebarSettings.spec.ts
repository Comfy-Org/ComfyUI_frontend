import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('Layout & sidebar settings', { tag: ['@settings'] }, () => {
  test.describe('Comfy.Sidebar.Size', () => {
    test('"small" applies small-sidebar class', async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.Sidebar.Size', 'small')
      await expect(comfyPage.menu.sideToolbar).toContainClass('small-sidebar')
    })

    test('"normal" does not apply small-sidebar class', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('Comfy.Sidebar.Size', 'normal')
      await expect(comfyPage.menu.sideToolbar).not.toContainClass(
        'small-sidebar'
      )
    })
  })

  test.describe('Comfy.Sidebar.Style', () => {
    // `isConnected` overrides the Style setting when the toolbar overflows;
    // small (48px) items keep content under the default viewport so Style
    // actually drives rendering.
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.Sidebar.Size', 'small')
    })

    test('"connected" applies connected-sidebar class', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('Comfy.Sidebar.Style', 'connected')
      await expect(comfyPage.menu.sideToolbar).toContainClass(
        'connected-sidebar'
      )
      await expect(comfyPage.menu.sideToolbar).not.toContainClass(
        'floating-sidebar'
      )
    })

    test('"floating" applies floating-sidebar class', async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.Sidebar.Style', 'floating')
      await expect(comfyPage.menu.sideToolbar).toContainClass(
        'floating-sidebar'
      )
      await expect(comfyPage.menu.sideToolbar).not.toContainClass(
        'connected-sidebar'
      )
    })

    test('"floating" + Size "normal" is overridden to connected by overflow', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('Comfy.Sidebar.Size', 'normal')
      await comfyPage.settings.setSetting('Comfy.Sidebar.Style', 'floating')
      await expect(comfyPage.menu.sideToolbar).toContainClass(
        'connected-sidebar'
      )
      await expect(comfyPage.menu.sideToolbar).toContainClass(
        'overflowing-sidebar'
      )
    })

    test('"floating" + Size "normal" renders floating in a viewport tall enough to fit', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('Comfy.Sidebar.Size', 'normal')
      await comfyPage.settings.setSetting('Comfy.Sidebar.Style', 'floating')
      await comfyPage.page.setViewportSize({ width: 1280, height: 1500 })
      await expect(comfyPage.menu.sideToolbar).toContainClass(
        'floating-sidebar'
      )
      await expect(comfyPage.menu.sideToolbar).not.toContainClass(
        'overflowing-sidebar'
      )
    })
  })

  test.describe('Comfy.UI.TabBarLayout', () => {
    test('"Default" renders integrated tab bar actions container', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('Comfy.UI.TabBarLayout', 'Default')
      await expect(comfyPage.menu.topbar.integratedTabBarActions).toBeAttached()
    })

    test('"Legacy" does not render integrated tab bar actions container', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('Comfy.UI.TabBarLayout', 'Legacy')
      await expect(comfyPage.menu.topbar.integratedTabBarActions).toHaveCount(0)
    })
  })

  test.describe('Comfy.TreeExplorer.ItemPadding', () => {
    // The setting writes a CSS var consumed by .p-tree-node-content,
    // which only renders in the legacy PrimeVue Tree.
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.NodeLibrary.NewDesign', false)
      await comfyPage.menu.nodeLibraryTab.open()
    })

    test('low padding (0px) is applied to tree node content', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('Comfy.TreeExplorer.ItemPadding', 0)
      await expect(
        comfyPage.menu.nodeLibraryTab.nodeLibraryTree
          .locator('.p-tree-node-content')
          .first()
      ).toHaveCSS('padding', '0px')
    })

    test('high padding (8px) is applied to tree node content', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('Comfy.TreeExplorer.ItemPadding', 8)
      await expect(
        comfyPage.menu.nodeLibraryTab.nodeLibraryTree
          .locator('.p-tree-node-content')
          .first()
      ).toHaveCSS('padding', '8px')
    })
  })
})
