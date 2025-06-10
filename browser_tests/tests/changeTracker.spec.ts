import {
  ComfyPage,
  comfyExpect as expect,
  comfyPageFixture as test
} from '../fixtures/ComfyPage'
import { PerformanceMonitor } from '../helpers/performanceMonitor'

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

    test('@perf Can undo multiple operations', async ({ comfyPage }) => {
      const perfMonitor = new PerformanceMonitor(comfyPage.page)
      const testName = 'undo-multiple-operations'

      await perfMonitor.startMonitoring(testName)

      expect(await comfyPage.getUndoQueueSize()).toBe(0)
      expect(await comfyPage.getRedoQueueSize()).toBe(0)

      // Save, confirm no errors & workflow modified flag removed
      await perfMonitor.measureOperation('save-workflow', async () => {
        await comfyPage.menu.topbar.saveWorkflow('undo-redo-test')
      })
      expect(await comfyPage.getToastErrorCount()).toBe(0)
      expect(await comfyPage.isCurrentWorkflowModified()).toBe(false)
      expect(await comfyPage.getUndoQueueSize()).toBe(0)
      expect(await comfyPage.getRedoQueueSize()).toBe(0)

      const node = (await comfyPage.getFirstNodeRef())!

      await perfMonitor.measureOperation('click-node-title', async () => {
        await node.click('title')
      })

      await perfMonitor.measureOperation('collapse-node', async () => {
        await node.click('collapse')
      })
      await expect(node).toBeCollapsed()
      expect(await comfyPage.isCurrentWorkflowModified()).toBe(true)
      expect(await comfyPage.getUndoQueueSize()).toBe(1)
      expect(await comfyPage.getRedoQueueSize()).toBe(0)

      await perfMonitor.measureOperation('bypass-node', async () => {
        await comfyPage.ctrlB()
      })
      await expect(node).toBeBypassed()
      expect(await comfyPage.isCurrentWorkflowModified()).toBe(true)
      expect(await comfyPage.getUndoQueueSize()).toBe(2)
      expect(await comfyPage.getRedoQueueSize()).toBe(0)

      await perfMonitor.markEvent('before-undo-operations')

      await perfMonitor.measureOperation('undo-bypass', async () => {
        await comfyPage.ctrlZ()
      })
      await expect(node).not.toBeBypassed()
      expect(await comfyPage.isCurrentWorkflowModified()).toBe(true)
      expect(await comfyPage.getUndoQueueSize()).toBe(1)
      expect(await comfyPage.getRedoQueueSize()).toBe(1)

      await perfMonitor.measureOperation('undo-collapse', async () => {
        await comfyPage.ctrlZ()
      })
      await expect(node).not.toBeCollapsed()
      expect(await comfyPage.isCurrentWorkflowModified()).toBe(false)
      expect(await comfyPage.getUndoQueueSize()).toBe(0)
      expect(await comfyPage.getRedoQueueSize()).toBe(2)

      await perfMonitor.finishMonitoring(testName)
    })
  })

  test('@perf Can group multiple change actions into a single transaction', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'group-change-transactions'

    await perfMonitor.startMonitoring(testName)

    const node = (await comfyPage.getFirstNodeRef())!
    expect(node).toBeTruthy()
    await expect(node).not.toBeCollapsed()
    await expect(node).not.toBeBypassed()

    await perfMonitor.markEvent('individual-changes-start')

    // Make changes outside set
    // Bypass + collapse node
    await perfMonitor.measureOperation('click-node-title', async () => {
      await node.click('title')
    })

    await perfMonitor.measureOperation('collapse-node', async () => {
      await node.click('collapse')
    })

    await perfMonitor.measureOperation('bypass-node', async () => {
      await comfyPage.ctrlB()
    })
    await expect(node).toBeCollapsed()
    await expect(node).toBeBypassed()

    // Undo, undo, ensure both changes undone
    await perfMonitor.measureOperation('undo-bypass', async () => {
      await comfyPage.ctrlZ()
    })
    await expect(node).not.toBeBypassed()
    await expect(node).toBeCollapsed()

    await perfMonitor.measureOperation('undo-collapse', async () => {
      await comfyPage.ctrlZ()
    })
    await expect(node).not.toBeBypassed()
    await expect(node).not.toBeCollapsed()

    // Prevent clicks registering a double-click
    await perfMonitor.measureOperation('click-empty-space', async () => {
      await comfyPage.clickEmptySpace()
    })

    await perfMonitor.measureOperation('click-node-title-again', async () => {
      await node.click('title')
    })

    await perfMonitor.markEvent('transaction-changes-start')

    // Run again, but within a change transaction
    await perfMonitor.measureOperation('begin-change-transaction', async () => {
      await beforeChange(comfyPage)
    })

    await perfMonitor.measureOperation('collapse-in-transaction', async () => {
      await node.click('collapse')
    })

    await perfMonitor.measureOperation('bypass-in-transaction', async () => {
      await comfyPage.ctrlB()
    })
    await expect(node).toBeCollapsed()
    await expect(node).toBeBypassed()

    // End transaction
    await perfMonitor.measureOperation('end-change-transaction', async () => {
      await afterChange(comfyPage)
    })

    // Ensure undo reverts both changes
    await perfMonitor.measureOperation('undo-transaction', async () => {
      await comfyPage.ctrlZ()
    })
    await expect(node).not.toBeBypassed()
    await expect(node).not.toBeCollapsed()

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Can nest multiple change transactions without adding undo steps', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'nested-change-transactions'

    await perfMonitor.startMonitoring(testName)

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

    await perfMonitor.measureOperation(
      'execute-nested-transactions',
      async () => {
        await multipleChanges()
      }
    )

    await perfMonitor.measureOperation('undo-all-changes', async () => {
      await comfyPage.ctrlZ()
    })
    await expect(node).not.toBeBypassed()
    await expect(node).not.toBePinned()
    await expect(node).not.toBeCollapsed()

    await perfMonitor.measureOperation('redo-all-changes', async () => {
      await comfyPage.ctrlY()
    })
    await expect(node).toBeBypassed()
    await expect(node).toBePinned()
    await expect(node).toBeCollapsed()

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Can detect changes in workflow.extra', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'detect-workflow-extra-changes'

    await perfMonitor.startMonitoring(testName)

    expect(await comfyPage.getUndoQueueSize()).toBe(0)

    await perfMonitor.measureOperation('modify-workflow-extra', async () => {
      await comfyPage.page.evaluate(() => {
        window['app'].graph.extra.foo = 'bar'
      })
    })

    // Click empty space to trigger a change detection.
    await perfMonitor.measureOperation('trigger-change-detection', async () => {
      await comfyPage.clickEmptySpace()
    })
    expect(await comfyPage.getUndoQueueSize()).toBe(1)

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Ignores changes in workflow.ds', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'ignore-workflow-ds-changes'

    await perfMonitor.startMonitoring(testName)

    expect(await comfyPage.getUndoQueueSize()).toBe(0)

    await perfMonitor.measureOperation('pan-canvas', async () => {
      await comfyPage.pan({ x: 10, y: 10 })
    })
    expect(await comfyPage.getUndoQueueSize()).toBe(0)

    await perfMonitor.finishMonitoring(testName)
  })
})
