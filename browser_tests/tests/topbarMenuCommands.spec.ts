import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('Topbar menu commands', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.Workflow.WorkflowTabsPosition',
      'Topbar'
    )
    await comfyPage.setup()
  })

  test('New command creates a new workflow tab', async ({ comfyPage }) => {
    const topbar = comfyPage.menu.topbar
    await expect.poll(() => topbar.getTabNames()).toHaveLength(1)

    await topbar.triggerTopbarCommand(['New'])

    await expect.poll(() => topbar.getTabNames()).toHaveLength(2)
  })

  test('Edit > Undo undoes the last action', async ({ comfyPage }) => {
    const initialNodeCount = await comfyPage.nodeOps.getNodeCount()

    await comfyPage.page.evaluate(() => {
      const node = window.LiteGraph!.createNode('Note')
      window.app!.graph!.add(node)
    })
    await comfyPage.nextFrame()

    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount())
      .toBe(initialNodeCount + 1)

    await comfyPage.menu.topbar.triggerTopbarCommand(['Edit', 'Undo'])

    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount())
      .toBe(initialNodeCount)
  })

  test('Edit > Redo restores an undone action', async ({ comfyPage }) => {
    const initialNodeCount = await comfyPage.nodeOps.getNodeCount()

    await comfyPage.page.evaluate(() => {
      const node = window.LiteGraph!.createNode('Note')
      window.app!.graph!.add(node)
    })
    await comfyPage.nextFrame()

    await comfyPage.menu.topbar.triggerTopbarCommand(['Edit', 'Undo'])
    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount())
      .toBe(initialNodeCount)

    await comfyPage.menu.topbar.triggerTopbarCommand(['Edit', 'Redo'])
    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount())
      .toBe(initialNodeCount + 1)
  })

  test('File > Save opens save dialog', async ({ comfyPage }) => {
    await comfyPage.menu.topbar.triggerTopbarCommand(['File', 'Save'])

    const saveDialog = comfyPage.menu.topbar.getSaveDialog()
    await expect(saveDialog).toBeVisible()
  })

  test('View > Bottom Panel toggles bottom panel', async ({ comfyPage }) => {
    await expect(comfyPage.bottomPanel.root).toBeHidden()

    await comfyPage.menu.topbar.triggerTopbarCommand(['View', 'Bottom Panel'])
    await expect(comfyPage.bottomPanel.root).toBeVisible()

    await comfyPage.menu.topbar.triggerTopbarCommand(['View', 'Bottom Panel'])
    await expect(comfyPage.bottomPanel.root).toBeHidden()
  })
})
