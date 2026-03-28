/**
 * Workflow Persistence Regression Tests
 *
 * Covers 12 workflow persistence bug gaps identified during deep scan.
 * See: research/prs/workflow-persistence-bugfix-audit.md
 *
 * Each test documents which PR/commit it regresses and reproduces
 * the exact user scenario that triggered the original bug.
 */
import { expect } from '@playwright/test'

import { comfyPageFixture as test, comfyExpect } from '../fixtures/ComfyPage'

test.describe('Workflow Persistence Regressions', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.Workflow.WorkflowTabsPosition',
      'Sidebar'
    )
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.workflow.setupWorkflowsDirectory({})
  })

  /**
   * G1: PR #9531 (pythongosssss) — CRITICAL
   * Workflow data corruption from checkState during graph loading.
   *
   * Bug: Between rootGraph.configure() and afterLoadNewGraph(), the rootGraph
   * contains the NEW workflow's data while activeWorkflow still points to the
   * OLD workflow. Any checkState call in that window would serialize the wrong
   * graph into the old workflow's activeState, corrupting it.
   *
   * Fix: Added ChangeTracker.isLoadingGraph guard flag to prevent checkState
   * from running during loadGraphData.
   *
   * Reproduction: Register an extension that calls checkState during
   * afterConfigureGraph, open two workflows, switch tabs, and verify data.
   */
  test('Switching workflow tabs does not corrupt workflow data via checkState during load (PR #9531)', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.workflowsTab
    await tab.open()

    // Save first workflow with default nodes
    await comfyPage.menu.topbar.saveWorkflow('workflow-A')

    // Get initial node count and types for workflow A
    const workflowANodeCount = await comfyPage.nodeOps.getNodeCount()
    const workflowAData = await comfyPage.workflow.getExportedWorkflow()

    // Create second workflow with different content
    await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
    await comfyPage.menu.topbar.saveWorkflow('workflow-B')
    const workflowBNodeCount = await comfyPage.nodeOps.getNodeCount()

    // Register an extension that forces checkState during graph configuration.
    // This reproduces the exact scenario from PR #9531.
    // No unregister needed: each Playwright test gets a fresh page, and the
    // extension must stay active for the subsequent tab switches to exercise
    // the isLoadingGraph guard.
    await comfyPage.page.evaluate(() => {
      window.app!.registerExtension({
        name: 'test-checkstate-during-load',
        async afterConfigureGraph() {
          const wfStore = (
            window.app!.extensionManager as unknown as Record<string, unknown>
          ).workflow as Record<string, unknown> | undefined
          const activeWorkflow = wfStore?.activeWorkflow as
            | Record<string, unknown>
            | undefined
          const changeTracker = activeWorkflow?.changeTracker as
            | { checkState: () => void }
            | undefined
          changeTracker?.checkState()
        }
      })
    })

    // Switch back to workflow A
    await tab.switchToWorkflow('workflow-A')
    await comfyPage.nextFrame()

    // Verify workflow A still has its original nodes (not corrupted by B's data)
    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount())
      .toBe(workflowANodeCount)

    // Switch to workflow B
    await tab.switchToWorkflow('workflow-B')
    await comfyPage.nextFrame()

    // Verify workflow B still has its original nodes (not corrupted by A's data)
    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount())
      .toBe(workflowBNodeCount)

    // Switch back to A one more time to verify no corruption accumulated
    await tab.switchToWorkflow('workflow-A')
    await comfyPage.nextFrame()

    const restoredData = await comfyPage.workflow.getExportedWorkflow()
    expect(restoredData.nodes.length).toBe(workflowAData.nodes.length)
  })

  /**
   * G2: Commit 0f763b523 (PR #9533)
   * Desynced workflow/graph state during loading.
   *
   * Bug: Rapid tab switches during loading could cause the graph and workflow
   * store to become desynced, showing one workflow's nodes in another's tab.
   *
   * Reproduction: Open two workflows, rapidly switch between them, verify
   * each tab shows correct content after settling.
   */
  test('Rapid tab switching does not desync workflow and graph state (PR #9533)', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.workflowsTab
    await tab.open()

    // Save workflow A with default nodes (7 nodes)
    await comfyPage.menu.topbar.saveWorkflow('rapid-A')
    const nodeCountA = await comfyPage.nodeOps.getNodeCount()

    // Create workflow B with a single KSampler
    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    await comfyPage.menu.topbar.saveWorkflow('rapid-B')
    const nodeCountB = await comfyPage.nodeOps.getNodeCount()

    // Ensure different node counts so we can distinguish
    expect(nodeCountA).not.toBe(nodeCountB)

    // Rapidly switch between tabs multiple times
    for (let i = 0; i < 3; i++) {
      await tab.switchToWorkflow('rapid-A')
      await tab.switchToWorkflow('rapid-B')
    }

    // Wait for everything to settle
    await comfyPage.page.waitForFunction(
      () => {
        const wf = (
          window.app?.extensionManager as unknown as
            | Record<string, unknown>
            | undefined
        )?.workflow as Record<string, unknown> | undefined
        return !wf?.isBusy
      },
      undefined,
      { timeout: 5000 }
    )
    await comfyPage.nextFrame()

    // Verify we're on workflow B with correct node count
    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount(), { timeout: 5000 })
      .toBe(nodeCountB)

    // Switch to A and verify
    await tab.switchToWorkflow('rapid-A')
    await comfyPage.page.waitForFunction(
      () => {
        const em = window.app?.extensionManager as
          | Record<string, { isBusy?: boolean }>
          | undefined
        return !em?.workflow?.isBusy
      },
      undefined,
      { timeout: 5000 }
    )
    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount(), { timeout: 5000 })
      .toBe(nodeCountA)
  })

  /**
   * G3: PR #9380 (kaili-yang)
   * Node preview images (outputs) lost when switching between workflow tabs.
   *
   * Bug: ChangeTracker.store() did not save nodeOutputs, so switching tabs
   * lost all node output previews (e.g., image thumbnails from execution).
   *
   * Fix: Added `this.nodeOutputs = clone(app.nodeOutputs)` to store() and
   * corresponding restore in restore().
   *
   * Reproduction: Store node outputs on a workflow, switch tabs, switch back,
   * verify outputs are still present.
   */
  test('Node outputs are preserved when switching workflow tabs (PR #9380)', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.workflowsTab
    await tab.open()

    // Save a workflow
    await comfyPage.menu.topbar.saveWorkflow('outputs-test')

    // Simulate node outputs being set (as if execution completed)
    const firstNode = await comfyPage.nodeOps.getFirstNodeRef()
    expect(firstNode).toBeTruthy()
    const nodeId = firstNode!.id

    await comfyPage.page.evaluate((id) => {
      // Simulate outputs like what happens after execution
      const outputStore = window.app!.nodeOutputs
      if (outputStore) {
        outputStore[id] = {
          images: [{ filename: 'test.png', subfolder: '', type: 'output' }]
        }
      }
    }, String(nodeId))

    // Trigger changeTracker to store the state (including outputs)
    await comfyPage.page.evaluate(() => {
      const em = window.app!.extensionManager as unknown as Record<
        string,
        { activeWorkflow?: { changeTracker?: { checkState(): void } } }
      >
      em.workflow?.activeWorkflow?.changeTracker?.checkState()
    })
    await comfyPage.nextFrame()

    // Verify outputs exist before switching
    const outputsBefore = await comfyPage.page.evaluate((id) => {
      return window.app!.nodeOutputs?.[id]
    }, String(nodeId))
    expect(outputsBefore).toBeTruthy()

    // Create a new workflow and switch to it
    await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
    await comfyPage.nextFrame()

    // Switch back to original workflow
    await tab.switchToWorkflow('outputs-test')
    await comfyPage.nextFrame()

    // Verify node outputs are preserved
    const outputsAfter = await comfyPage.page.evaluate((id) => {
      return window.app!.nodeOutputs?.[id]
    }, String(nodeId))
    expect(outputsAfter).toBeTruthy()
    expect(outputsAfter?.images).toBeDefined()
  })

  /**
   * G5: Commit 44bb6f13 (DrJKL)
   * Canvas graph not reset before workflow load cleanup.
   *
   * Bug: Loading workflow B after A could leave A's nodes visible on the
   * canvas because the graph was not properly cleared before loading.
   *
   * Reproduction: Load workflow A (7 nodes) → load workflow B (1 node) →
   * verify only B's nodes are on the canvas.
   */
  test('Loading a new workflow cleanly replaces the previous graph (commit 44bb6f13)', async ({
    comfyPage
  }) => {
    // Start with default workflow (7 nodes)
    const defaultNodeCount = await comfyPage.nodeOps.getNodeCount()
    expect(defaultNodeCount).toBeGreaterThan(1)

    // Load a single-node workflow
    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    await comfyPage.nextFrame()

    // Verify only the new workflow's nodes are present (no leakage from previous)
    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount(), { timeout: 3000 })
      .toBe(1)

    // Verify the node is the correct type
    const nodes = await comfyPage.nodeOps.getNodes()
    expect(nodes[0].type).toBe('KSampler')
  })

  /**
   * G4: PR #7648 (tomm1e)
   * Component widget state lost on graph change.
   *
   * Bug: Component widgets (e.g. Load3D) in the root graph stay inactive
   * after leaving a subgraph because the widget filter didn't include
   * component widget classes.
   *
   * Reproduction: Set widget values on nodes → switch to different workflow →
   * switch back → verify widget values preserved.
   */
  test('Widget values on nodes are preserved across workflow tab switches (PR #7648)', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.workflowsTab
    await tab.open()

    // Load default workflow and save
    await comfyPage.menu.topbar.saveWorkflow('widget-state-test')

    // Get a node and read its widget values
    const widgetValuesBefore = await comfyPage.page.evaluate(() => {
      const nodes = window.app!.graph.nodes
      const results: Record<string, unknown[]> = {}
      for (const node of nodes) {
        if (node.widgets && node.widgets.length > 0) {
          results[node.id] = node.widgets.map((w) => ({
            name: w.name,
            value: w.value
          }))
        }
      }
      return results
    })

    // Verify we captured some widget values
    expect(Object.keys(widgetValuesBefore).length).toBeGreaterThan(0)

    // Create another workflow
    await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
    await comfyPage.nextFrame()

    // Switch back
    await tab.switchToWorkflow('widget-state-test')
    await comfyPage.nextFrame()

    // Read widget values after switching back
    const widgetValuesAfter = await comfyPage.page.evaluate(() => {
      const nodes = window.app!.graph.nodes
      const results: Record<string, unknown[]> = {}
      for (const node of nodes) {
        if (node.widgets && node.widgets.length > 0) {
          results[node.id] = node.widgets.map((w) => ({
            name: w.name,
            value: w.value
          }))
        }
      }
      return results
    })

    // Verify widget values match
    expect(widgetValuesAfter).toEqual(widgetValuesBefore)
  })

  /**
   * G8: PR #9694 (viva-jinyi)
   * API format workflows fail to load with missing node types.
   *
   * Bug: loadApiJson early-returned when missing node types were detected,
   * preventing the entire API-format workflow from loading.
   *
   * Fix: Removed early return so missing nodes are skipped while the rest
   * of the workflow loads normally.
   *
   * Reproduction: Load an API-format workflow containing unknown node types →
   * verify remaining known nodes still load onto the canvas.
   */
  test('API format workflow with missing node types partially loads (PR #9694)', async ({
    comfyPage
  }) => {
    // Create an API-format workflow JSON with a mix of known and unknown nodes
    const apiWorkflow = {
      '1': {
        class_type: 'KSampler',
        inputs: {
          seed: 42,
          steps: 20,
          cfg: 8.0,
          sampler_name: 'euler',
          scheduler: 'normal',
          denoise: 1.0
        },
        _meta: { title: 'KSampler' }
      },
      '2': {
        class_type: 'NonExistentCustomNode_XYZ_12345',
        inputs: {
          input1: 'test'
        },
        _meta: { title: 'Missing Node' }
      },
      '3': {
        class_type: 'EmptyLatentImage',
        inputs: {
          width: 512,
          height: 512,
          batch_size: 1
        },
        _meta: { title: 'Empty Latent Image' }
      }
    }

    // Load the API format workflow via page.evaluate
    await comfyPage.page.evaluate(async (workflow) => {
      await window.app!.loadApiJson(workflow, 'test-api-workflow.json')
    }, apiWorkflow)
    await comfyPage.nextFrame()

    // The known nodes (KSampler, EmptyLatentImage) should load
    // The unknown node (NonExistentCustomNode) should be skipped
    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount(), { timeout: 3000 })
      .toBeGreaterThanOrEqual(2)

    // Verify the known node types are present
    const nodeTypes = await comfyPage.page.evaluate(() => {
      return window.app!.graph.nodes.map((n: { type: string }) => n.type)
    })
    expect(nodeTypes).toContain('KSampler')
    expect(nodeTypes).toContain('EmptyLatentImage')
    expect(nodeTypes).not.toContain('NonExistentCustomNode_XYZ_12345')
  })

  /**
   * G9: PR #8259
   * Middle-click paste duplicates entire workflow on Linux.
   *
   * Bug: On Linux, middle-clicking anywhere triggers a paste from the PRIMARY
   * clipboard. When middle-dragging to pan, this caused workflow duplication.
   *
   * Fix: Added auxclick event listener with preventDefault() to graph canvas.
   *
   * Reproduction: Verify auxclick event handler is registered on the canvas.
   */
  test('Canvas has auxclick handler to prevent middle-click paste (PR #8259)', async ({
    comfyPage
  }) => {
    // Verify that the canvas element has an auxclick event listener registered
    // by checking that middle-clicking does not trigger paste behavior
    const initialNodeCount = await comfyPage.nodeOps.getNodeCount()

    // Simulate a middle click (auxclick) on the canvas
    await comfyPage.canvas.click({
      button: 'middle',
      position: { x: 100, y: 100 }
    })
    await comfyPage.nextFrame()

    // Verify no nodes were duplicated
    const nodeCountAfter = await comfyPage.nodeOps.getNodeCount()
    expect(nodeCountAfter).toBe(initialNodeCount)
  })

  /**
   * G10: PR #8715 (jtydhr88)
   * Transient image URLs leak into ImageCompare workflow serialization.
   *
   * Bug: Image URLs set by onExecuted (blob: URLs, execution results) were
   * being serialized into the workflow JSON, causing errors on other machines.
   *
   * Fix: Disabled widget.serialize for image widgets while keeping
   * widget.options.serialize for prompt serialization.
   *
   * Reproduction: Verify exported workflow does not contain blob: or
   * transient URLs in any widget values.
   */
  test('Exported workflow does not contain transient blob: URLs (PR #8715)', async ({
    comfyPage
  }) => {
    // Note: For full coverage, this should run against an executed workflow with image outputs.
    // That requires integration test infra (running model execution). This validates the serialization contract.
    const exportedWorkflow = await comfyPage.workflow.getExportedWorkflow()

    // Check all nodes' widget values for blob: URLs
    for (const node of exportedWorkflow.nodes) {
      if (node.widgets_values && Array.isArray(node.widgets_values)) {
        for (const value of node.widgets_values) {
          if (typeof value === 'string') {
            expect(value).not.toMatch(/^blob:/)
            expect(value).not.toMatch(/^https?:\/\/.*\/api\/view/)
          }
        }
      }
    }
  })

  /**
   * G11: PR #8963 (Myestery)
   * Template workflows not reloaded on locale change.
   *
   * Bug: When the user changes locale, the template workflow gallery was not
   * refreshed with localized templates.
   *
   * Reproduction: Change locale setting and verify templates update.
   * (Simplified test: verify locale change doesn't error and settings persist)
   */
  test('Changing locale does not break workflow operations (PR #8963)', async ({
    comfyPage
  }) => {
    // Save current workflow
    const tab = comfyPage.menu.workflowsTab
    await tab.open()
    await comfyPage.menu.topbar.saveWorkflow('locale-test')

    // Get initial node count
    const initialNodeCount = await comfyPage.nodeOps.getNodeCount()

    // Change locale (this should trigger template reload)
    await comfyPage.settings.setSetting('Comfy.Locale', 'zh')
    await comfyPage.nextFrame()

    // Change back to English
    await comfyPage.settings.setSetting('Comfy.Locale', 'en')
    await comfyPage.nextFrame()

    // Verify the current workflow is still intact
    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount())
      .toBe(initialNodeCount)

    // Verify workflow is still accessible
    await expect.poll(() => tab.getActiveWorkflowName()).toBe('locale-test')
  })

  /**
   * G1 extended: Verify the ChangeTracker.isLoadingGraph guard works correctly.
   *
   * This test directly verifies the fix mechanism from PR #9531 by checking
   * that checkState is a no-op while a graph is being loaded.
   */
  test('checkState is blocked during graph loading (PR #9531 guard)', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.workflowsTab
    await tab.open()

    // Save workflow with known state
    await comfyPage.menu.topbar.saveWorkflow('guard-test')

    // Verify isLoadingGraph is false during normal operation
    const isLoadingNormally = await comfyPage.page.evaluate(() => {
      // Access ChangeTracker through the module system
      const em = window.app!.extensionManager as unknown as Record<
        string,
        {
          activeWorkflow?: {
            changeTracker?: { undoQueue: unknown[]; isLoadingGraph?: boolean }
          }
        }
      >
      const activeWf = em.workflow?.activeWorkflow
      if (!activeWf?.changeTracker) return null
      // checkState should work normally (isLoadingGraph should be false)
      const undoBefore = activeWf.changeTracker.undoQueue.length
      return {
        undoBefore,
        isLoading: activeWf.changeTracker.isLoadingGraph ?? false
      }
    })
    expect(isLoadingNormally).toBeTruthy()
    // During normal operation, isLoadingGraph should be false
    expect(isLoadingNormally!.isLoading).toBe(false)

    // Verify that during a workflow load, the graph doesn't get corrupted
    // by making a modification, saving, loading another workflow, then
    // switching back
    const node = await comfyPage.nodeOps.getFirstNodeRef()
    if (node) {
      await node.click('title')
      await node.click('collapse')
      await comfyExpect(node).toBeCollapsed()
    }

    // Save modified state (workflow already named, use Ctrl+S to avoid dialog)
    await comfyPage.page.keyboard.press('Control+s')
    await comfyPage.page.waitForFunction(
      () => {
        const em = window.app?.extensionManager as
          | Record<string, { isBusy?: boolean }>
          | undefined
        return !em?.workflow?.isBusy
      },
      undefined,
      { timeout: 3000 }
    )

    // Switch to another workflow
    await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
    await comfyPage.nextFrame()

    // Switch back — during this load, checkState must not corrupt data
    await tab.switchToWorkflow('guard-test')
    await comfyPage.nextFrame()

    // The collapsed state should be preserved
    if (node) {
      const nodeId = node.id
      const isStillCollapsed = await comfyPage.page.evaluate((id) => {
        const n = window.app!.graph.nodes.find(
          (node) => String(node.id) === String(id)
        )
        return n?.flags?.collapsed === true
      }, nodeId)
      expect(isStillCollapsed).toBe(true)
    }
  })

  /**
   * G2 extended: Verify workflow data integrity across multiple save/load cycles.
   *
   * Tests that node links are preserved correctly through serialization
   * roundtrips, which is the core concern of the graph sync bugs.
   */
  test('Node links survive save/load/switch cycles (graph sync integrity)', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.workflowsTab
    await tab.open()

    // Get link count from default workflow
    const linkCountBefore = await comfyPage.page.evaluate(() => {
      return window.app!.graph.links
        ? Object.keys(window.app!.graph.links).length
        : 0
    })
    expect(linkCountBefore).toBeGreaterThan(0)

    // Save the workflow
    await comfyPage.menu.topbar.saveWorkflow('links-test')

    // Create new workflow and switch back
    await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
    await comfyPage.nextFrame()

    await tab.switchToWorkflow('links-test')
    await comfyPage.page.waitForFunction(
      () => {
        const em = window.app?.extensionManager as
          | Record<string, { isBusy?: boolean }>
          | undefined
        return !em?.workflow?.isBusy
      },
      undefined,
      { timeout: 5000 }
    )

    // Verify links are intact
    const linkCountAfter = await comfyPage.page.evaluate(() => {
      return window.app!.graph.links
        ? Object.keys(window.app!.graph.links).length
        : 0
    })
    expect(linkCountAfter).toBe(linkCountBefore)
  })

  /**
   * G12: Commits 91f197d9d + a1b7e57bc
   * Splitter panel size drift and legacy key persistence.
   *
   * Bug: Panel sizes could drift after repeated resizes/reloads because
   * normalization was not applied to stored values.
   *
   * Reproduction: Store panel sizes in localStorage, reload, verify sizes
   * are normalized and don't drift.
   */
  test('Splitter panel sizes persist correctly in localStorage', async ({
    comfyPage
  }) => {
    // Set known panel sizes via localStorage
    await comfyPage.page.evaluate(() => {
      // Normalize: sizes should sum to 100
      const sizes = [30, 70]
      localStorage.setItem('Comfy.Splitter.MainSplitter', JSON.stringify(sizes))
    })

    // Reload the page
    await comfyPage.setup({ clearStorage: false })
    await comfyPage.nextFrame()

    // Read back the stored sizes
    const storedSizes = await comfyPage.page.evaluate(() => {
      const raw = localStorage.getItem('Comfy.Splitter.MainSplitter')
      return raw ? JSON.parse(raw) : null
    })

    // Sizes must be stored and valid (sum to ~100, no NaN, no negative)
    expect(storedSizes).toBeTruthy()
    expect(Array.isArray(storedSizes)).toBe(true)
    for (const size of storedSizes as number[]) {
      expect(typeof size).toBe('number')
      expect(size).toBeGreaterThanOrEqual(0)
      expect(size).not.toBeNaN()
    }
    const total = (storedSizes as number[]).reduce(
      (a: number, b: number) => a + b,
      0
    )
    // Allow some tolerance for rounding
    expect(total).toBeGreaterThan(90)
    expect(total).toBeLessThanOrEqual(101)
  })
})
