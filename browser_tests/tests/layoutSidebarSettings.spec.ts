import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

const SCREENSHOT_OPTIONS = { maxDiffPixels: 50 } as const

test.describe(
  'Layout & sidebar settings',
  { tag: ['@screenshot', '@settings'] },
  () => {
    test.describe('Comfy.Sidebar.Size', () => {
      test('"small" matches baseline', async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.Sidebar.Size', 'small')
        await expect(comfyPage.menu.sideToolbar).toHaveScreenshot(
          'sidebar-size-small.png',
          SCREENSHOT_OPTIONS
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

      test('"connected" matches baseline', async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.Sidebar.Style', 'connected')
        await expect(comfyPage.menu.sideToolbar).toHaveScreenshot(
          'sidebar-style-connected.png',
          SCREENSHOT_OPTIONS
        )
      })

      test('"floating" matches baseline', async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.Sidebar.Style', 'floating')
        await expect(comfyPage.menu.sideToolbar).toHaveScreenshot(
          'sidebar-style-floating.png',
          SCREENSHOT_OPTIONS
        )
      })

      test('"floating" + Size "normal" is overridden to connected by overflow', async ({
        comfyPage
      }) => {
        await comfyPage.settings.setSetting('Comfy.Sidebar.Size', 'normal')
        await comfyPage.settings.setSetting('Comfy.Sidebar.Style', 'floating')
        await expect(comfyPage.menu.sideToolbar).toHaveScreenshot(
          'sidebar-style-floating-normal-overflow.png',
          SCREENSHOT_OPTIONS
        )
      })

      test('"floating" + Size "normal" renders floating in a viewport tall enough to fit', async ({
        comfyPage
      }) => {
        await comfyPage.settings.setSetting('Comfy.Sidebar.Size', 'normal')
        await comfyPage.settings.setSetting('Comfy.Sidebar.Style', 'floating')
        await comfyPage.page.setViewportSize({ width: 1280, height: 1500 })
        await expect(comfyPage.menu.sideToolbar).toHaveScreenshot(
          'sidebar-style-floating-normal-tall-viewport.png',
          SCREENSHOT_OPTIONS
        )
      })
    })

    test.describe('Comfy.UI.TabBarLayout', () => {
      // Without this flag the integrated container has no visible children
      // in the local test env (not logged in, not desktop) and Default vs
      // Legacy are pixel-identical.
      test.use({ initialFeatureFlags: { show_signin_button: true } })

      test('"Default" matches baseline', async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.UI.TabBarLayout', 'Default')
        await expect(comfyPage.menu.topbar.workflowTabs).toHaveScreenshot(
          'tab-bar-layout-default.png',
          SCREENSHOT_OPTIONS
        )
      })

      test('"Legacy" matches baseline', async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.UI.TabBarLayout', 'Legacy')
        await expect(comfyPage.menu.topbar.workflowTabs).toHaveScreenshot(
          'tab-bar-layout-legacy.png',
          SCREENSHOT_OPTIONS
        )
      })
    })

    test.describe('Comfy.TreeExplorer.ItemPadding', () => {
      // The setting writes a CSS var consumed by .p-tree-node-content,
      // which only renders in the legacy PrimeVue Tree.
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.settings.setSetting(
          'Comfy.NodeLibrary.NewDesign',
          false
        )
        await comfyPage.menu.nodeLibraryTab.open()
      })

      test('low padding (0px) matches baseline', async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.TreeExplorer.ItemPadding', 0)
        await expect(
          comfyPage.menu.nodeLibraryTab.nodeLibraryTree
        ).toHaveScreenshot('tree-explorer-padding-low.png', SCREENSHOT_OPTIONS)
      })

      test('high padding (8px) matches baseline', async ({ comfyPage }) => {
        await comfyPage.settings.setSetting('Comfy.TreeExplorer.ItemPadding', 8)
        await expect(
          comfyPage.menu.nodeLibraryTab.nodeLibraryTree
        ).toHaveScreenshot('tree-explorer-padding-high.png', SCREENSHOT_OPTIONS)
      })
    })
  }
)
