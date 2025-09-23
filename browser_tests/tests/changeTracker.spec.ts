import {
  ComfyPage,
  comfyExpect as expect,
  comfyPageFixture as test
} from '../fixtures/ComfyPage'

async function beforeChange(comfyPage: ComfyPage) {
  await comfyPage.page.evaluate(() => {
    window['app'].canvas.emitBeforeChange()
  })
}
async function afterChange(comfyPage: ComfyPage) {
  await comfyPage.page.evaluate(() => {
    window['app'].canvas.emitAfterChange()
  })
}

test.describe('Change Tracker', () => {
  test.describe('Undo/Redo', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
      await comfyPage.setupWorkflowsDirectory({})
    })

    test('Can undo multiple operations', async ({ comfyPage }) => {
      expect(await comfyPage.getUndoQueueSize()).toBe(0)
      expect(await comfyPage.getRedoQueueSize()).toBe(0)

      // Save, confirm no errors & workflow modified flag removed
      await comfyPage.menu.topbar.saveWorkflow('undo-redo-test')
      expect(await comfyPage.getToastErrorCount()).toBe(0)
      expect(await comfyPage.isCurrentWorkflowModified()).toBe(false)
      expect(await comfyPage.getUndoQueueSize()).toBe(0)
      expect(await comfyPage.getRedoQueueSize()).toBe(0)

      const node = (await comfyPage.getFirstNodeRef())!
      await node.click('title')
      await node.click('collapse')
      await expect(node).toBeCollapsed()
      expect(await comfyPage.isCurrentWorkflowModified()).toBe(true)
      expect(await comfyPage.getUndoQueueSize()).toBe(1)
      expect(await comfyPage.getRedoQueueSize()).toBe(0)

      await comfyPage.ctrlB()
      await expect(node).toBeBypassed()
      expect(await comfyPage.isCurrentWorkflowModified()).toBe(true)
      expect(await comfyPage.getUndoQueueSize()).toBe(2)
      expect(await comfyPage.getRedoQueueSize()).toBe(0)

      await comfyPage.ctrlZ()
      await expect(node).not.toBeBypassed()
      expect(await comfyPage.isCurrentWorkflowModified()).toBe(true)
      expect(await comfyPage.getUndoQueueSize()).toBe(1)
      expect(await comfyPage.getRedoQueueSize()).toBe(1)

      await comfyPage.ctrlZ()
      await expect(node).not.toBeCollapsed()
      expect(await comfyPage.isCurrentWorkflowModified()).toBe(false)
      expect(await comfyPage.getUndoQueueSize()).toBe(0)
      expect(await comfyPage.getRedoQueueSize()).toBe(2)
    })
  })

  test('Can group multiple change actions into a single transaction', async ({
    comfyPage
  }) => {
    const node = (await comfyPage.getFirstNodeRef())!
    expect(node).toBeTruthy()
    await expect(node).not.toBeCollapsed()
    await expect(node).not.toBeBypassed()

    // Make changes outside set
    // Bypass + collapse node
    await node.click('title')
    await node.click('collapse')
    await comfyPage.ctrlB()
    await expect(node).toBeCollapsed()
    await expect(node).toBeBypassed()

    // Undo, undo, ensure both changes undone
    await comfyPage.ctrlZ()
    await expect(node).not.toBeBypassed()
    await expect(node).toBeCollapsed()
    await comfyPage.ctrlZ()
    await expect(node).not.toBeBypassed()
    await expect(node).not.toBeCollapsed()

    // Prevent clicks registering a double-click
    await comfyPage.clickEmptySpace()
    await node.click('title')

    // Run again, but within a change transaction
    await beforeChange(comfyPage)

    await node.click('collapse')
    await comfyPage.ctrlB()
    await expect(node).toBeCollapsed()
    await expect(node).toBeBypassed()

    // End transaction
    await afterChange(comfyPage)

    // Ensure undo reverts both changes
    await comfyPage.ctrlZ()
    await expect(node).not.toBeBypassed()
    await expect(node).not.toBeCollapsed()
  })

  test('Can nest multiple change transactions without adding undo steps', async ({
    comfyPage
  }) => {
    const node = (await comfyPage.getFirstNodeRef())!
    const bypassAndPin = async () => {
      await beforeChange(comfyPage)
      await comfyPage.ctrlB()
      await expect(node).toBeBypassed()
      await comfyPage.page.keyboard.press('KeyP')
      await comfyPage.nextFrame()
      await expect(node).toBePinned()
      await afterChange(comfyPage)
    }

    const collapse = async () => {
      await beforeChange(comfyPage)
      await node.click('collapse', { moveMouseToEmptyArea: true })
      await expect(node).toBeCollapsed()
      await afterChange(comfyPage)
    }

    const multipleChanges = async () => {
      await beforeChange(comfyPage)
      // Call other actions that uses begin/endChange
      await node.click('title')
      await collapse()
      await bypassAndPin()
      await afterChange(comfyPage)
    }

    await multipleChanges()

    await comfyPage.ctrlZ()
    await expect(node).not.toBeBypassed()
    await expect(node).not.toBePinned()
    await expect(node).not.toBeCollapsed()

    await comfyPage.ctrlY()
    await expect(node).toBeBypassed()
    await expect(node).toBePinned()
    await expect(node).toBeCollapsed()
  })

  test('Can detect changes in workflow.extra', async ({ comfyPage }) => {
    expect(await comfyPage.getUndoQueueSize()).toBe(0)
    await comfyPage.page.evaluate(() => {
      window['app'].graph.extra.foo = 'bar'
    })
    // Click empty space to trigger a change detection.
    await comfyPage.clickEmptySpace()
    expect(await comfyPage.getUndoQueueSize()).toBe(1)
  })

  test('Ignores changes in workflow.ds', async ({ comfyPage }) => {
    expect(await comfyPage.getUndoQueueSize()).toBe(0)
    await comfyPage.pan({ x: 10, y: 10 })
    expect(await comfyPage.getUndoQueueSize()).toBe(0)
  })
})
