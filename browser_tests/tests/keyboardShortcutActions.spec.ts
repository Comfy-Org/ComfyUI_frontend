import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('Keyboard shortcut actions', { tag: '@keyboard' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.Workflow.WorkflowTabsPosition',
      'Topbar'
    )
    await comfyPage.setup()
  })

  test('Ctrl+Z undoes the last graph change', async ({ comfyPage }) => {
    const initialNodeCount = await comfyPage.nodeOps.getNodeCount()

    await comfyPage.page.evaluate(() => {
      const node = window.LiteGraph!.createNode('Note')
      window.app!.graph!.add(node)
    })
    await comfyPage.nextFrame()
    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount())
      .toBe(initialNodeCount + 1)

    await comfyPage.canvas.click()
    await comfyPage.page.keyboard.press('ControlOrMeta+z')

    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount())
      .toBe(initialNodeCount)
  })

  test('Ctrl+Shift+Z redoes after undo', async ({ comfyPage }) => {
    const initialNodeCount = await comfyPage.nodeOps.getNodeCount()

    await comfyPage.page.evaluate(() => {
      const node = window.LiteGraph!.createNode('Note')
      window.app!.graph!.add(node)
    })
    await comfyPage.nextFrame()

    await comfyPage.canvas.click()
    await comfyPage.page.keyboard.press('ControlOrMeta+z')
    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount())
      .toBe(initialNodeCount)

    await comfyPage.page.keyboard.press('ControlOrMeta+Shift+z')
    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount())
      .toBe(initialNodeCount + 1)
  })

  test('Ctrl+S opens save dialog', async ({ comfyPage }) => {
    await comfyPage.canvas.click()
    await comfyPage.page.keyboard.press('ControlOrMeta+s')

    const saveDialog = comfyPage.menu.topbar.getSaveDialog()
    await expect(saveDialog).toBeVisible()
  })

  test('Ctrl+, opens settings dialog', async ({ comfyPage }) => {
    await comfyPage.page.keyboard.down('ControlOrMeta')
    await comfyPage.page.keyboard.press(',')
    await comfyPage.page.keyboard.up('ControlOrMeta')

    const settingsDialog = comfyPage.page.getByTestId('settings-dialog')
    await expect(settingsDialog).toBeVisible()
  })

  test('Escape closes settings dialog', async ({ comfyPage }) => {
    await comfyPage.page.keyboard.down('ControlOrMeta')
    await comfyPage.page.keyboard.press(',')
    await comfyPage.page.keyboard.up('ControlOrMeta')

    const settingsDialog = comfyPage.page.getByTestId('settings-dialog')
    await expect(settingsDialog).toBeVisible()

    await comfyPage.page.keyboard.press('Escape')
    await expect(settingsDialog).toBeHidden()
  })

  test('Delete key removes selected nodes', async ({ comfyPage }) => {
    const initialNodeCount = await comfyPage.nodeOps.getNodeCount()
    expect(initialNodeCount, 'Default graph should have nodes').toBeGreaterThan(
      0
    )

    await comfyPage.nodeOps.selectNodes(['KSampler'])
    await comfyPage.page.keyboard.press('Delete')

    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount())
      .toBeLessThan(initialNodeCount)
  })

  test('Ctrl+A selects all nodes', async ({ comfyPage }) => {
    await comfyPage.canvas.click()
    await comfyPage.page.keyboard.press('ControlOrMeta+a')

    const totalNodes = await comfyPage.nodeOps.getNodeCount()
    const selectedNodes = await comfyPage.page.evaluate(() =>
      window.app!.canvas?.selected_nodes
        ? Object.keys(window.app!.canvas.selected_nodes).length
        : 0
    )

    expect(selectedNodes).toBe(totalNodes)
  })
})
