import type { ComfyPage } from '../fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../fixtures/ComfyPage'
import type { WorkspaceStore } from '../types/globals'

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
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
      await comfyPage.workflow.setupWorkflowsDirectory({})
    })

    test('Can undo multiple operations', async ({ comfyPage }) => {
      expect(await comfyPage.workflow.getUndoQueueSize()).toBe(0)
      expect(await comfyPage.workflow.getRedoQueueSize()).toBe(0)

      // Save, confirm no errors & workflow modified flag removed
      await comfyPage.menu.topbar.saveWorkflow('undo-redo-test')
      expect(await comfyPage.toast.getToastErrorCount()).toBe(0)
      expect(await comfyPage.workflow.isCurrentWorkflowModified()).toBe(false)
      expect(await comfyPage.workflow.getUndoQueueSize()).toBe(0)
      expect(await comfyPage.workflow.getRedoQueueSize()).toBe(0)

      const node = (await comfyPage.nodeOps.getFirstNodeRef())!
      await node.click('title')
      await node.click('collapse')
      await expect(node).toBeCollapsed()
      expect(await comfyPage.workflow.isCurrentWorkflowModified()).toBe(true)
      expect(await comfyPage.workflow.getUndoQueueSize()).toBe(1)
      expect(await comfyPage.workflow.getRedoQueueSize()).toBe(0)

      await comfyPage.keyboard.bypass()
      await expect(node).toBeBypassed()
      expect(await comfyPage.workflow.isCurrentWorkflowModified()).toBe(true)
      expect(await comfyPage.workflow.getUndoQueueSize()).toBe(2)
      expect(await comfyPage.workflow.getRedoQueueSize()).toBe(0)

      await comfyPage.keyboard.undo()
      await expect(node).not.toBeBypassed()
      expect(await comfyPage.workflow.isCurrentWorkflowModified()).toBe(true)
      expect(await comfyPage.workflow.getUndoQueueSize()).toBe(1)
      expect(await comfyPage.workflow.getRedoQueueSize()).toBe(1)

      await comfyPage.keyboard.undo()
      await expect(node).not.toBeCollapsed()
      expect(await comfyPage.workflow.isCurrentWorkflowModified()).toBe(false)
      expect(await comfyPage.workflow.getUndoQueueSize()).toBe(0)
      expect(await comfyPage.workflow.getRedoQueueSize()).toBe(2)
    })

    test('undo/redo restores link topology with reroutes and floating links', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('links/batch_move_links')

      const readTopology = () =>
        comfyPage.page.evaluate(() => {
          const graph = window.app!.rootGraph
          return {
            links: graph.links.size,
            floatingLinks: graph.floatingLinks.size,
            reroutes: graph.reroutes.size,
            serialised: graph.serialize()
          }
        })

      const baseline = await readTopology()

      await beforeChange(comfyPage)
      await comfyPage.page.evaluate(() => {
        const graph = window.app!.rootGraph
        const firstLink = graph.links.values().next().value
        if (!firstLink) throw new Error('Expected at least one link')

        const reroute = graph.createReroute(
          [firstLink.id * 5, firstLink.id * 3],
          firstLink
        )
        graph.addFloatingLink(firstLink.toFloating('output', reroute.id))
      })
      await afterChange(comfyPage)

      const mutated = await readTopology()
      expect(mutated.floatingLinks).toBeGreaterThan(baseline.floatingLinks)
      expect(mutated.reroutes).toBeGreaterThan(baseline.reroutes)
      await expect.poll(() => comfyPage.workflow.getUndoQueueSize()).toBe(1)

      await comfyPage.page.evaluate(async () => {
        await (
          window.app!.extensionManager as WorkspaceStore
        ).workflow.activeWorkflow?.changeTracker.undo()
      })
      const afterUndo = await readTopology()
      expect(afterUndo.links).toBe(baseline.links)
      expect(afterUndo.floatingLinks).toBe(baseline.floatingLinks)
      expect(afterUndo.reroutes).toBe(baseline.reroutes)
      expect(afterUndo.serialised).toEqual(baseline.serialised)

      await comfyPage.page.evaluate(async () => {
        await (
          window.app!.extensionManager as WorkspaceStore
        ).workflow.activeWorkflow?.changeTracker.redo()
      })
      const afterRedo = await readTopology()
      expect(afterRedo.links).toBe(mutated.links)
      expect(afterRedo.floatingLinks).toBe(mutated.floatingLinks)
      expect(afterRedo.reroutes).toBe(mutated.reroutes)
      expect(afterRedo.serialised).toEqual(mutated.serialised)
    })

    test('read-through accessors stay in sync for links, floating links, and reroutes', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('links/batch_move_links')

      const parity = await comfyPage.page.evaluate(() => {
        const graph = window.app!.rootGraph
        const firstLink = graph.links.values().next().value
        if (!firstLink) throw new Error('Expected at least one link')

        const reroute = graph.createReroute(
          [firstLink.id * 7, firstLink.id * 4],
          firstLink
        )
        const floatingLink = firstLink.toFloating('output', reroute.id)
        graph.addFloatingLink(floatingLink)

        return {
          normalLinkMatches:
            graph.getLink(firstLink.id) === graph.links.get(firstLink.id),
          floatingLinkRequiresExplicitProjection:
            graph.getLink(floatingLink.id) === undefined &&
            graph.floatingLinks.get(floatingLink.id) !== undefined,
          rerouteMatches:
            graph.getReroute(reroute.id) === graph.reroutes.get(reroute.id)
        }
      })

      expect(parity.normalLinkMatches).toBe(true)
      expect(parity.floatingLinkRequiresExplicitProjection).toBe(true)
      expect(parity.rerouteMatches).toBe(true)
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

    // Ensure undo reverts both changes
    await comfyPage.keyboard.undo()
    await expect(node).not.toBeBypassed()
    await expect(node).not.toBeCollapsed()
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
    expect(await comfyPage.workflow.getUndoQueueSize()).toBe(0)
    await comfyPage.page.evaluate(() => {
      window.app!.graph!.extra.foo = 'bar'
    })
    // Click empty space to trigger a change detection.
    await comfyPage.canvasOps.clickEmptySpace()
    await expect.poll(() => comfyPage.workflow.getUndoQueueSize()).toBe(1)
  })

  test('Ignores changes in workflow.ds', async ({ comfyPage }) => {
    expect(await comfyPage.workflow.getUndoQueueSize()).toBe(0)
    await comfyPage.canvasOps.pan({ x: 10, y: 10 })
    await expect.poll(() => comfyPage.workflow.getUndoQueueSize()).toBe(0)
  })
})
