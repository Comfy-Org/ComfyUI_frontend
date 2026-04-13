import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { WorkspaceStore } from '@e2e/types/globals'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

type ChangeTrackerDebugState = {
  changeCount: number
  graphMatchesActiveState: boolean
  isLoadingGraph: boolean
  isModified: boolean | undefined
  redoQueueSize: number
  restoringState: boolean
  undoQueueSize: number
}

async function getChangeTrackerDebugState(comfyPage: ComfyPage) {
  return await comfyPage.page.evaluate(() => {
    type ChangeTrackerClassLike = {
      graphEqual: (left: unknown, right: unknown) => boolean
      isLoadingGraph: boolean
    }

    type ChangeTrackerLike = {
      _restoringState: boolean
      activeState: unknown
      changeCount: number
      constructor: ChangeTrackerClassLike
      redoQueue: unknown[]
      undoQueue: unknown[]
    }

    type ActiveWorkflowLike = {
      changeTracker?: ChangeTrackerLike
      isModified?: boolean
    }

    const workflowStore = window.app!.extensionManager as WorkspaceStore
    const workflow = workflowStore.workflow
      .activeWorkflow as ActiveWorkflowLike | null
    const tracker = workflow?.changeTracker
    if (!workflow || !tracker) {
      throw new Error('Active workflow change tracker is not available')
    }

    const currentState = JSON.parse(
      JSON.stringify(window.app!.rootGraph.serialize())
    )
    return {
      changeCount: tracker.changeCount,
      graphMatchesActiveState: tracker.constructor.graphEqual(
        tracker.activeState,
        currentState
      ),
      isLoadingGraph: tracker.constructor.isLoadingGraph,
      isModified: workflow.isModified,
      redoQueueSize: tracker.redoQueue.length,
      restoringState: tracker._restoringState,
      undoQueueSize: tracker.undoQueue.length
    } satisfies ChangeTrackerDebugState
  })
}

async function waitForChangeTrackerSettled(
  comfyPage: ComfyPage,
  expected: Pick<
    ChangeTrackerDebugState,
    'isModified' | 'redoQueueSize' | 'undoQueueSize'
  >
) {
  // Visible node flags can flip before undo finishes loadGraphData() and
  // updates the tracker. Poll the tracker's own settled state so we do not
  // start the next transaction while checkState() is still gated.
  await expect
    .poll(() => getChangeTrackerDebugState(comfyPage))
    .toMatchObject({
      changeCount: 0,
      graphMatchesActiveState: true,
      isLoadingGraph: false,
      restoringState: false,
      ...expected
    })
}

async function beforeChange(comfyPage: ComfyPage) {
  await comfyPage.page.evaluate(() => {
    window.app!.canvas!.emitBeforeChange()
  })
}

async function afterChange(comfyPage: ComfyPage) {
  await comfyPage.page.evaluate(() => {
    window.app!.canvas!.emitAfterChange()
  })
}

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
})

test.describe('Change Tracker', { tag: '@workflow' }, () => {
  test.describe('Undo/Redo', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.setupWorkflowsDirectory({})
    })

    test('Can undo multiple operations', async ({ comfyPage }) => {
      await expect.poll(() => comfyPage.workflow.getUndoQueueSize()).toBe(0)
      await expect.poll(() => comfyPage.workflow.getRedoQueueSize()).toBe(0)

      // Save, confirm no errors & workflow modified flag removed
      await comfyPage.menu.topbar.saveWorkflow('undo-redo-test')
      await expect(comfyPage.toast.toastErrors).toHaveCount(0)
      await expect
        .poll(() => comfyPage.workflow.isCurrentWorkflowModified())
        .toBe(false)
      await expect.poll(() => comfyPage.workflow.getUndoQueueSize()).toBe(0)
      await expect.poll(() => comfyPage.workflow.getRedoQueueSize()).toBe(0)

      const node = (await comfyPage.nodeOps.getFirstNodeRef())!
      await node.click('title')
      await node.click('collapse')
      await expect(node).toBeCollapsed()
      await expect
        .poll(() => comfyPage.workflow.isCurrentWorkflowModified())
        .toBe(true)
      await expect.poll(() => comfyPage.workflow.getUndoQueueSize()).toBe(1)
      await expect.poll(() => comfyPage.workflow.getRedoQueueSize()).toBe(0)

      await comfyPage.keyboard.bypass()
      await expect(node).toBeBypassed()
      await expect
        .poll(() => comfyPage.workflow.isCurrentWorkflowModified())
        .toBe(true)
      await expect.poll(() => comfyPage.workflow.getUndoQueueSize()).toBe(2)
      await expect.poll(() => comfyPage.workflow.getRedoQueueSize()).toBe(0)

      await comfyPage.keyboard.undo()
      await expect(node).not.toBeBypassed()
      await waitForChangeTrackerSettled(comfyPage, {
        isModified: true,
        redoQueueSize: 1,
        undoQueueSize: 1
      })

      await comfyPage.keyboard.undo()
      await expect(node).not.toBeCollapsed()
      await waitForChangeTrackerSettled(comfyPage, {
        isModified: false,
        redoQueueSize: 2,
        undoQueueSize: 0
      })
    })
  })

  test('Can group multiple change actions into a single transaction', async ({
    comfyPage
  }) => {
    const node = (await comfyPage.nodeOps.getFirstNodeRef())!
    expect(node).toBeTruthy()
    await expect(node).not.toBeCollapsed()
    await expect(node).not.toBeBypassed()

    // Make changes outside set
    // Bypass + collapse node
    await node.click('title')
    await node.click('collapse')
    await comfyPage.keyboard.bypass()
    await expect(node).toBeCollapsed()
    await expect(node).toBeBypassed()

    // Undo, undo, ensure both changes undone
    await comfyPage.keyboard.undo()
    await expect(node).not.toBeBypassed()
    await expect(node).toBeCollapsed()
    await comfyPage.keyboard.undo()
    await expect(node).not.toBeBypassed()
    await expect(node).not.toBeCollapsed()
    await waitForChangeTrackerSettled(comfyPage, {
      isModified: false,
      redoQueueSize: 2,
      undoQueueSize: 0
    })

    // Prevent clicks registering a double-click
    await comfyPage.canvasOps.clickEmptySpace()
    await node.click('title')

    // Run again, but within a change transaction
    await beforeChange(comfyPage)

    await node.click('collapse')
    await comfyPage.keyboard.bypass()
    await expect(node).toBeCollapsed()
    await expect(node).toBeBypassed()

    // End transaction
    await afterChange(comfyPage)
    await waitForChangeTrackerSettled(comfyPage, {
      isModified: true,
      redoQueueSize: 0,
      undoQueueSize: 1
    })

    // Ensure undo reverts both changes
    await comfyPage.keyboard.undo()
    await expect(node).not.toBeBypassed()
    await expect(node).not.toBeCollapsed()
    await waitForChangeTrackerSettled(comfyPage, {
      isModified: false,
      redoQueueSize: 1,
      undoQueueSize: 0
    })
  })

  test('Can nest multiple change transactions without adding undo steps', async ({
    comfyPage
  }) => {
    const node = (await comfyPage.nodeOps.getFirstNodeRef())!
    const bypassAndPin = async () => {
      await beforeChange(comfyPage)
      await comfyPage.keyboard.bypass()
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

    await comfyPage.keyboard.undo()
    await expect(node).not.toBeBypassed()
    await expect(node).not.toBePinned()
    await expect(node).not.toBeCollapsed()

    await comfyPage.keyboard.redo()
    await expect(node).toBeBypassed()
    await expect(node).toBePinned()
    await expect(node).toBeCollapsed()
  })

  test('Can detect changes in workflow.extra', async ({ comfyPage }) => {
    await expect.poll(() => comfyPage.workflow.getUndoQueueSize()).toBe(0)
    await comfyPage.page.evaluate(() => {
      window.app!.graph!.extra.foo = 'bar'
    })
    // Click empty space to trigger a change detection.
    await comfyPage.canvasOps.clickEmptySpace()
    await expect.poll(() => comfyPage.workflow.getUndoQueueSize()).toBe(1)
  })

  test('Ignores changes in workflow.ds', async ({ comfyPage }) => {
    await expect.poll(() => comfyPage.workflow.getUndoQueueSize()).toBe(0)
    await comfyPage.canvasOps.pan({ x: 10, y: 10 })
    await expect.poll(() => comfyPage.workflow.getUndoQueueSize()).toBe(0)
  })
})
