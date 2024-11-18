import {
  ComfyPage,
  comfyPageFixture as test,
  comfyExpect as expect
} from './fixtures/ComfyPage'
import type { useWorkspaceStore } from '../src/stores/workspaceStore'

type WorkspaceStore = ReturnType<typeof useWorkspaceStore>

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
      function isModified() {
        return comfyPage.page.evaluate(async () => {
          return !!(window['app'].extensionManager as WorkspaceStore).workflow
            .activeWorkflow?.isModified
        })
      }

      function getUndoQueueSize() {
        return comfyPage.page.evaluate(() => {
          const workflow = (window['app'].extensionManager as WorkspaceStore)
            .workflow.activeWorkflow
          return workflow?.changeTracker.undoQueue.length
        })
      }

      function getRedoQueueSize() {
        return comfyPage.page.evaluate(() => {
          const workflow = (window['app'].extensionManager as WorkspaceStore)
            .workflow.activeWorkflow
          return workflow?.changeTracker.redoQueue.length
        })
      }
      expect(await getUndoQueueSize()).toBe(0)
      expect(await getRedoQueueSize()).toBe(0)

      // Save, confirm no errors & workflow modified flag removed
      await comfyPage.menu.topbar.saveWorkflow('undo-redo-test')
      expect(await comfyPage.getToastErrorCount()).toBe(0)
      expect(await isModified()).toBe(false)

      // TODO(huchenlei): Investigate why saving the workflow is causing the
      // undo queue to be triggered.
      expect(await getUndoQueueSize()).toBe(1)
      expect(await getRedoQueueSize()).toBe(0)

      const node = (await comfyPage.getFirstNodeRef())!
      await node.click('collapse')
      await expect(node).toBeCollapsed()
      expect(await isModified()).toBe(true)
      expect(await getUndoQueueSize()).toBe(2)
      expect(await getRedoQueueSize()).toBe(0)

      await comfyPage.ctrlB()
      await expect(node).toBeBypassed()
      expect(await isModified()).toBe(true)
      expect(await getUndoQueueSize()).toBe(3)
      expect(await getRedoQueueSize()).toBe(0)

      await comfyPage.ctrlZ()
      await expect(node).not.toBeBypassed()
      expect(await isModified()).toBe(true)
      expect(await getUndoQueueSize()).toBe(2)
      expect(await getRedoQueueSize()).toBe(1)

      await comfyPage.ctrlZ()
      await expect(node).not.toBeCollapsed()
      expect(await isModified()).toBe(false)
      expect(await getUndoQueueSize()).toBe(1)
      expect(await getRedoQueueSize()).toBe(2)
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
})
