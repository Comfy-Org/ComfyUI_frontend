import { expect } from '@playwright/test'
import { comfyPageFixture as test } from './ComfyPage'

test.describe('Menu', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.page.evaluate(async () => {
      await window['app'].ui.settings.setSettingValueAsync(
        'Comfy.UseNewMenu',
        'Top'
      )
    })
  })

  test.afterEach(async ({ comfyPage }) => {
    const currentThemeId = await comfyPage.menu.getThemeId()
    if (currentThemeId !== 'dark') {
      await comfyPage.menu.toggleTheme()
    }
    await comfyPage.page.evaluate(async () => {
      await window['app'].ui.settings.setSettingValueAsync(
        'Comfy.UseNewMenu',
        'Disabled'
      )
    })
  })

  test('Toggle theme', async ({ comfyPage }) => {
    test.setTimeout(30000)

    expect(await comfyPage.menu.getThemeId()).toBe('dark')

    await comfyPage.menu.toggleTheme()

    expect(await comfyPage.menu.getThemeId()).toBe('light')

    // Theme id should persist after reload.
    await comfyPage.page.reload()
    await comfyPage.setup()
    expect(await comfyPage.menu.getThemeId()).toBe('light')

    await comfyPage.menu.toggleTheme()

    expect(await comfyPage.menu.getThemeId()).toBe('dark')
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

  test('Sidebar node preview and drag to canvas', async ({ comfyPage }) => {
    // Open the sidebar
    const tab = comfyPage.menu.nodeLibraryTab
    await tab.open()
    await tab.toggleFirstFolder()

    // Hover over a node to display the preview
    const nodeSelector = '.p-tree-node-leaf'
    await comfyPage.page.hover(nodeSelector)

    // Verify the preview is displayed
    const previewVisible = await comfyPage.page.isVisible(
      '.node-lib-node-preview'
    )
    expect(previewVisible).toBe(true)

    const count = await comfyPage.getGraphNodesCount()
    // Drag the node onto the canvas
    const canvasSelector = '#graph-canvas'
    await comfyPage.page.dragAndDrop(nodeSelector, canvasSelector)

    // Verify the node is added to the canvas
    expect(await comfyPage.getGraphNodesCount()).toBe(count + 1)
  })
})
