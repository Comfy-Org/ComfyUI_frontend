import { readFileSync } from 'fs'
import path from 'path'

import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Workflow Persistence', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting(
      'Comfy.Workflow.WorkflowTabsPosition',
      'Sidebar'
    )
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.workflow.setupWorkflowsDirectory({})
  })

  test('Rapid tab switching does not desync workflow and graph state', async ({
    comfyPage
  }) => {
    test.info().annotations.push({
      type: 'regression',
      description: 'PR #9533 — desynced workflow/graph state during loading'
    })

    const tab = comfyPage.menu.workflowsTab
    await tab.open()

    await comfyPage.menu.topbar.saveWorkflow('rapid-A')
    const nodeCountA = await comfyPage.nodeOps.getNodeCount()

    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    await comfyPage.menu.topbar.saveWorkflow('rapid-B')
    const nodeCountB = await comfyPage.nodeOps.getNodeCount()

    expect(nodeCountA).not.toBe(nodeCountB)

    for (let i = 0; i < 3; i++) {
      await tab.switchToWorkflow('rapid-A')
      await tab.switchToWorkflow('rapid-B')
    }

    await comfyPage.workflow.waitForWorkflowIdle()
    await comfyPage.nextFrame()

    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount(), { timeout: 5000 })
      .toBe(nodeCountB)

    await tab.switchToWorkflow('rapid-A')
    await comfyPage.workflow.waitForWorkflowIdle()
    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount(), { timeout: 5000 })
      .toBe(nodeCountA)
  })

  test('Node outputs are preserved when switching workflow tabs', async ({
    comfyPage
  }) => {
    test.info().annotations.push({
      type: 'regression',
      description:
        'PR #9380 — ChangeTracker.store() did not save nodeOutputs, losing preview images on tab switch'
    })

    const tab = comfyPage.menu.workflowsTab
    await tab.open()

    await comfyPage.menu.topbar.saveWorkflow('outputs-test')

    const firstNode = await comfyPage.nodeOps.getFirstNodeRef()
    expect(firstNode).toBeTruthy()
    const nodeId = firstNode!.id

    // Simulate node outputs as if execution completed
    await comfyPage.page.evaluate((id) => {
      const outputStore = window.app!.nodeOutputs
      if (outputStore) {
        outputStore[id] = {
          images: [{ filename: 'test.png', subfolder: '', type: 'output' }]
        }
      }
    }, String(nodeId))

    // Trigger changeTracker to capture current state including outputs
    await comfyPage.page.evaluate(() => {
      const em = window.app!.extensionManager as unknown as Record<
        string,
        { activeWorkflow?: { changeTracker?: { checkState(): void } } }
      >
      em.workflow?.activeWorkflow?.changeTracker?.checkState()
    })
    await comfyPage.nextFrame()

    const outputsBefore = await comfyPage.page.evaluate((id) => {
      return window.app!.nodeOutputs?.[id]
    }, String(nodeId))
    expect(outputsBefore).toBeTruthy()

    await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
    await comfyPage.nextFrame()

    await tab.switchToWorkflow('outputs-test')
    await comfyPage.nextFrame()

    const outputsAfter = await comfyPage.page.evaluate((id) => {
      return window.app!.nodeOutputs?.[id]
    }, String(nodeId))
    expect(outputsAfter).toBeTruthy()
    expect(outputsAfter?.images).toBeDefined()
  })

  test('Loading a new workflow cleanly replaces the previous graph', async ({
    comfyPage
  }) => {
    test.info().annotations.push({
      type: 'regression',
      description:
        'Commit 44bb6f13 — canvas graph not reset before workflow load'
    })

    const defaultNodeCount = await comfyPage.nodeOps.getNodeCount()
    expect(defaultNodeCount).toBeGreaterThan(1)

    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    await comfyPage.nextFrame()

    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount(), { timeout: 3000 })
      .toBe(1)

    const nodes = await comfyPage.nodeOps.getNodes()
    expect(nodes[0].type).toBe('KSampler')
  })

  test('Widget values on nodes are preserved across workflow tab switches', async ({
    comfyPage
  }) => {
    test.info().annotations.push({
      type: 'regression',
      description: 'PR #7648 — component widget state lost on graph change'
    })

    const tab = comfyPage.menu.workflowsTab
    await tab.open()

    await comfyPage.menu.topbar.saveWorkflow('widget-state-test')

    // Read widget values via page.evaluate — these are internal LiteGraph
    // state not exposed through DOM
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

    expect(Object.keys(widgetValuesBefore).length).toBeGreaterThan(0)

    await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
    await comfyPage.nextFrame()

    await tab.switchToWorkflow('widget-state-test')
    await comfyPage.nextFrame()

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

    expect(widgetValuesAfter).toEqual(widgetValuesBefore)
  })

  test('API format workflow with missing node types partially loads', async ({
    comfyPage
  }) => {
    test.info().annotations.push({
      type: 'regression',
      description: 'PR #9694 — loadApiJson early-returned on missing node types'
    })

    const fixturePath = path.resolve(
      __dirname,
      '../assets/nodes/api_workflow_with_missing_nodes.json'
    )
    const apiWorkflow = JSON.parse(readFileSync(fixturePath, 'utf-8'))

    await comfyPage.page.evaluate(async (workflow) => {
      await window.app!.loadApiJson(workflow, 'test-api-workflow.json')
    }, apiWorkflow)
    await comfyPage.nextFrame()

    // Known nodes (KSampler, EmptyLatentImage) should load; unknown node skipped
    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount(), { timeout: 3000 })
      .toBeGreaterThanOrEqual(2)

    const nodeTypes = await comfyPage.page.evaluate(() => {
      return window.app!.graph.nodes.map((n: { type: string }) => n.type)
    })
    expect(nodeTypes).toContain('KSampler')
    expect(nodeTypes).toContain('EmptyLatentImage')
    expect(nodeTypes).not.toContain('NonExistentCustomNode_XYZ_12345')
  })

  test('Canvas has auxclick handler to prevent middle-click paste', async ({
    comfyPage
  }) => {
    test.info().annotations.push({
      type: 'regression',
      description:
        'PR #8259 — middle-click paste duplicates entire workflow on Linux'
    })

    const initialNodeCount = await comfyPage.nodeOps.getNodeCount()

    await comfyPage.canvas.click({
      button: 'middle',
      position: { x: 100, y: 100 }
    })
    await comfyPage.nextFrame()

    const nodeCountAfter = await comfyPage.nodeOps.getNodeCount()
    expect(nodeCountAfter).toBe(initialNodeCount)
  })

  test('Exported workflow does not contain transient blob: URLs', async ({
    comfyPage
  }) => {
    test.info().annotations.push({
      type: 'regression',
      description:
        'PR #8715 — transient image URLs leaked into workflow serialization'
    })

    const exportedWorkflow = await comfyPage.workflow.getExportedWorkflow()

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

  test('Changing locale does not break workflow operations', async ({
    comfyPage
  }) => {
    test.info().annotations.push({
      type: 'regression',
      description: 'PR #8963 — template workflows not reloaded on locale change'
    })

    const tab = comfyPage.menu.workflowsTab
    await tab.open()
    await comfyPage.menu.topbar.saveWorkflow('locale-test')

    const initialNodeCount = await comfyPage.nodeOps.getNodeCount()

    await comfyPage.settings.setSetting('Comfy.Locale', 'zh')
    await comfyPage.nextFrame()

    await comfyPage.settings.setSetting('Comfy.Locale', 'en')
    await comfyPage.nextFrame()

    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount())
      .toBe(initialNodeCount)

    await expect.poll(() => tab.getActiveWorkflowName()).toBe('locale-test')
  })

  test('Node links survive save/load/switch cycles', async ({ comfyPage }) => {
    test.info().annotations.push({
      type: 'regression',
      description: 'PR #9533 — node links must survive serialization roundtrips'
    })

    const tab = comfyPage.menu.workflowsTab
    await tab.open()

    // Link count requires internal graph state — not exposed via DOM
    const linkCountBefore = await comfyPage.page.evaluate(() => {
      return window.app!.graph.links
        ? Object.keys(window.app!.graph.links).length
        : 0
    })
    expect(linkCountBefore).toBeGreaterThan(0)

    await comfyPage.menu.topbar.saveWorkflow('links-test')

    await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
    await comfyPage.nextFrame()

    await tab.switchToWorkflow('links-test')
    await comfyPage.workflow.waitForWorkflowIdle()

    const linkCountAfter = await comfyPage.page.evaluate(() => {
      return window.app!.graph.links
        ? Object.keys(window.app!.graph.links).length
        : 0
    })
    expect(linkCountAfter).toBe(linkCountBefore)
  })

  test('Splitter panel sizes persist correctly in localStorage', async ({
    comfyPage
  }) => {
    test.info().annotations.push({
      type: 'regression',
      description:
        'Commits 91f197d9d + a1b7e57bc — splitter panel size drift on reload'
    })

    await comfyPage.page.evaluate(() => {
      localStorage.setItem(
        'Comfy.Splitter.MainSplitter',
        JSON.stringify([30, 70])
      )
    })

    await comfyPage.setup({ clearStorage: false })
    await comfyPage.nextFrame()

    const storedSizes = await comfyPage.page.evaluate(() => {
      const raw = localStorage.getItem('Comfy.Splitter.MainSplitter')
      return raw ? JSON.parse(raw) : null
    })

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
    expect(total).toBeGreaterThan(90)
    expect(total).toBeLessThanOrEqual(101)
  })
})
