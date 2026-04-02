import { readFileSync } from 'fs'

import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import type { ComfyPage } from '../fixtures/ComfyPage'

const generateUniqueFilename = (extension = '') =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}${extension}`

const waitForV2DraftSave = async (comfyPage: ComfyPage, since: number) => {
  await comfyPage.page.waitForFunction((savedSince) => {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (!key?.startsWith('Comfy.Workflow.DraftIndex.v2:')) continue

      const json = window.localStorage.getItem(key)
      if (!json) continue

      try {
        const index = JSON.parse(json)
        if (
          typeof index.updatedAt === 'number' &&
          index.updatedAt >= savedSince
        ) {
          return true
        }
      } catch {
        // Ignore malformed storage while waiting for the debounce to flush.
      }
    }

    return false
  }, since)
}

const waitForTabStatePersistence = async (
  comfyPage: ComfyPage,
  minPaths = 2
) => {
  await comfyPage.page.waitForFunction((expectedMinPaths) => {
    let activePathKey: string | null = null
    let openPathsKey: string | null = null

    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i)
      if (key?.startsWith('Comfy.Workflow.ActivePath:')) {
        activePathKey = key
      }
      if (key?.startsWith('Comfy.Workflow.OpenPaths:')) {
        openPathsKey = key
      }
    }

    if (!activePathKey || !openPathsKey) {
      return false
    }

    const activePointerRaw = window.sessionStorage.getItem(activePathKey)
    const openPointerRaw = window.sessionStorage.getItem(openPathsKey)
    if (!activePointerRaw || !openPointerRaw) {
      return false
    }

    try {
      const activePointer = JSON.parse(activePointerRaw) as {
        workspaceId?: unknown
        path?: unknown
      }
      const openPointer = JSON.parse(openPointerRaw) as {
        paths?: unknown[]
      }

      return (
        typeof activePointer.workspaceId === 'string' &&
        typeof activePointer.path === 'string' &&
        Array.isArray(openPointer.paths) &&
        openPointer.paths.length >= expectedMinPaths
      )
    } catch {
      return false
    }
  }, minPaths)
}

const forceActivePathToFirstOpenWorkflow = async (comfyPage: ComfyPage) => {
  await comfyPage.page.evaluate(() => {
    let activePathKey: string | null = null
    let openPathsKey: string | null = null

    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i)
      if (key?.startsWith('Comfy.Workflow.ActivePath:')) {
        activePathKey = key
      }
      if (key?.startsWith('Comfy.Workflow.OpenPaths:')) {
        openPathsKey = key
      }
    }

    if (!activePathKey || !openPathsKey) {
      throw new Error('Expected workflow persistence session state to exist')
    }

    const activePointerRaw = window.sessionStorage.getItem(activePathKey)
    const openPointerRaw = window.sessionStorage.getItem(openPathsKey)
    if (!activePointerRaw || !openPointerRaw) {
      throw new Error('Expected workflow persistence session payloads to exist')
    }

    const activePointer = JSON.parse(activePointerRaw) as {
      workspaceId: string
      path: string
    }
    const openPointer = JSON.parse(openPointerRaw) as {
      workspaceId: string
      paths: string[]
      activeIndex: number
    }

    if (openPointer.paths.length < 2) {
      throw new Error('Expected at least two saved workflow paths in tab state')
    }

    activePointer.path = openPointer.paths[0]
    openPointer.activeIndex = 1

    window.sessionStorage.setItem(activePathKey, JSON.stringify(activePointer))
    window.sessionStorage.setItem(openPathsKey, JSON.stringify(openPointer))
  })
}

test.describe('Workflow persistence regressions', { tag: '@workflow' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.Workflow.WorkflowTabsPosition',
      'Sidebar'
    )
    await comfyPage.workflow.setupWorkflowsDirectory({})
    await comfyPage.settings.setSetting('Comfy.Workflow.Persist', true)
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

    await comfyPage.page.evaluate((id) => {
      const outputStore = window.app!.nodeOutputs
      if (outputStore) {
        outputStore[id] = {
          images: [{ filename: 'test.png', subfolder: '', type: 'output' }]
        }
      }
    }, String(nodeId))

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

    const fixturePath = comfyPage.assetPath(
      'nodes/api_workflow_with_missing_nodes.json'
    )
    const apiWorkflow = JSON.parse(readFileSync(fixturePath, 'utf-8'))

    await comfyPage.page.evaluate(async (workflow) => {
      await window.app!.loadApiJson(workflow, 'test-api-workflow.json')
    }, apiWorkflow)
    await comfyPage.nextFrame()

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

  test('restores all saved tabs even when active-path state is stale, and restores saved-workflow drafts', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting(
      'Comfy.Workflow.WorkflowTabsPosition',
      'Topbar'
    )

    const workflowA = generateUniqueFilename()
    const workflowB = generateUniqueFilename()

    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    await comfyPage.menu.topbar.saveWorkflow(workflowA)

    const firstNode = (await comfyPage.nodeOps.getFirstNodeRef())!
    const draftSaveStartedAt = Date.now()
    await firstNode.click('collapse')
    await comfyPage.canvasOps.clickEmptySpace()
    expect(await firstNode.isCollapsed()).toBe(true)

    await waitForV2DraftSave(comfyPage, draftSaveStartedAt)

    await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
    await comfyPage.menu.topbar.saveWorkflow(workflowB)

    await waitForTabStatePersistence(comfyPage)
    await forceActivePathToFirstOpenWorkflow(comfyPage)

    await comfyPage.setup({ clearStorage: false })
    await comfyPage.nextFrame()

    const tabs = await comfyPage.menu.topbar.getTabNames()
    expect(tabs).toEqual(expect.arrayContaining([workflowA, workflowB]))
    expect(tabs.indexOf(workflowA)).toBeLessThan(tabs.indexOf(workflowB))
    expect(await comfyPage.menu.topbar.getActiveTabName()).toBe(workflowB)

    await comfyPage.menu.topbar.getWorkflowTab(workflowA).click()
    await comfyPage.nextFrame()
    await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(1)

    const restoredNode = (await comfyPage.nodeOps.getFirstNodeRef())!
    expect(await restoredNode.isCollapsed()).toBe(true)
    expect(await comfyPage.toast.getToastErrorCount()).toBe(0)
  })

  test('Closing an inactive tab with save preserves its own content', async ({
    comfyPage
  }) => {
    test.info().annotations.push({
      type: 'regression',
      description:
        'PR #10745 — saveWorkflow called checkState on inactive tab, serializing the active graph instead'
    })

    await comfyPage.settings.setSetting(
      'Comfy.Workflow.WorkflowTabsPosition',
      'Topbar'
    )

    const suffix = Date.now().toString(36)
    const nameA = `test-A-${suffix}`
    const nameB = `test-B-${suffix}`

    await comfyPage.menu.topbar.saveWorkflow(nameA)
    const nodeCountA = await comfyPage.nodeOps.getNodeCount()

    await comfyPage.command.executeCommand('Comfy.DuplicateWorkflow')
    await comfyPage.nextFrame()
    await comfyPage.menu.topbar.saveWorkflow(nameB)

    await comfyPage.page.evaluate(() => {
      window.app!.graph.add(window.LiteGraph!.createNode('Note', undefined, {}))
    })
    await comfyPage.nextFrame()

    const nodeCountB = await comfyPage.nodeOps.getNodeCount()
    expect(nodeCountB).toBe(nodeCountA + 1)

    await comfyPage.page.evaluate(() => {
      const em = window.app!.extensionManager as unknown as Record<
        string,
        { activeWorkflow?: { changeTracker?: { checkState(): void } } }
      >
      em.workflow?.activeWorkflow?.changeTracker?.checkState()
    })

    await comfyPage.menu.topbar.getWorkflowTab(nameA).click()
    await comfyPage.workflow.waitForWorkflowIdle()
    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount(), { timeout: 3000 })
      .toBe(nodeCountA)

    await comfyPage.menu.topbar.getWorkflowTab(nameB).click({
      button: 'middle'
    })

    const saveButton = comfyPage.page.getByRole('button', { name: 'Save' })
    await saveButton.waitFor({ state: 'visible' })
    await saveButton.click()
    await comfyPage.workflow.waitForWorkflowIdle()
    await comfyPage.nextFrame()

    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount(), { timeout: 3000 })
      .toBe(nodeCountA)

    const workflowsTab = comfyPage.menu.workflowsTab
    await workflowsTab.open()
    await workflowsTab.getPersistedItem(nameB).dblclick()
    await comfyPage.workflow.waitForWorkflowIdle()

    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount(), { timeout: 5000 })
      .toBe(nodeCountB)
  })

  test('Closing an inactive unsaved tab with save preserves its own content', async ({
    comfyPage
  }) => {
    test.info().annotations.push({
      type: 'regression',
      description:
        'PR #10745 — saveWorkflowAs called checkState on inactive temp tab, serializing the active graph'
    })

    await comfyPage.settings.setSetting(
      'Comfy.Workflow.WorkflowTabsPosition',
      'Topbar'
    )

    const suffix = Date.now().toString(36)
    const nameA = `test-A-${suffix}`
    const nameB = `test-B-${suffix}`

    await comfyPage.menu.topbar.saveWorkflow(nameA)
    const nodeCountA = await comfyPage.nodeOps.getNodeCount()

    await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
    await comfyPage.nextFrame()

    await comfyPage.page.evaluate(() => {
      window.app!.graph.add(window.LiteGraph!.createNode('Note', undefined, {}))
    })
    await comfyPage.nextFrame()

    await comfyPage.page.evaluate(() => {
      const em = window.app!.extensionManager as unknown as Record<
        string,
        { activeWorkflow?: { changeTracker?: { checkState(): void } } }
      >
      em.workflow?.activeWorkflow?.changeTracker?.checkState()
    })

    const nodeCountB = await comfyPage.nodeOps.getNodeCount()
    expect(nodeCountB).toBe(1)
    expect(nodeCountA).not.toBe(nodeCountB)

    await comfyPage.menu.topbar.getWorkflowTab(nameA).click()
    await comfyPage.workflow.waitForWorkflowIdle()
    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount(), { timeout: 3000 })
      .toBe(nodeCountA)

    await comfyPage.menu.topbar
      .getWorkflowTab('Unsaved Workflow')
      .click({ button: 'middle' })

    const dialog = comfyPage.page.getByRole('dialog')
    const saveButton = dialog.getByRole('button', { name: 'Save' })
    await saveButton.waitFor({ state: 'visible' })
    await saveButton.click()

    const saveDialog = comfyPage.menu.topbar.getSaveDialog()
    await saveDialog.waitFor({ state: 'visible' })
    await saveDialog.fill(nameB)
    await comfyPage.page.keyboard.press('Enter')
    await comfyPage.workflow.waitForWorkflowIdle()
    await comfyPage.nextFrame()

    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount(), { timeout: 3000 })
      .toBe(nodeCountA)

    const workflowsTab = comfyPage.menu.workflowsTab
    await workflowsTab.open()
    await workflowsTab.getPersistedItem(nameB).dblclick()
    await comfyPage.workflow.waitForWorkflowIdle()

    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount(), { timeout: 5000 })
      .toBe(nodeCountB)
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