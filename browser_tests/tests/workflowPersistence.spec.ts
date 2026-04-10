import { readFileSync } from 'fs'

import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

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

async function getNodeOutputImageCount(
  comfyPage: ComfyPage,
  nodeId: string
): Promise<number> {
  return await comfyPage.page.evaluate(
    (id) => window.app!.nodeOutputs?.[id]?.images?.length ?? 0,
    nodeId
  )
}

async function getWidgetValueSnapshot(
  comfyPage: ComfyPage
): Promise<Record<string, Array<{ name: string; value: unknown }>>> {
  return await comfyPage.page.evaluate(() => {
    const nodes = window.app!.graph.nodes
    const results: Record<string, Array<{ name: string; value: unknown }>> = {}
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
}

async function getLinkCount(comfyPage: ComfyPage): Promise<number> {
  return await comfyPage.page.evaluate(() => {
    return window.app!.graph.links
      ? Object.keys(window.app!.graph.links).length
      : 0
  })
}

test.describe('Workflow Persistence', () => {
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
    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount())
      .not.toBe(nodeCountA)
    const nodeCountB = await comfyPage.nodeOps.getNodeCount()

    for (let i = 0; i < 3; i++) {
      await tab.switchToWorkflow('rapid-A')
      await tab.switchToWorkflow('rapid-B')
    }

    await comfyPage.workflow.waitForWorkflowIdle()
    await comfyPage.nextFrame()

    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(nodeCountB)

    await tab.switchToWorkflow('rapid-A')
    await comfyPage.workflow.waitForWorkflowIdle()
    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(nodeCountA)
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
    const nodeId = String(firstNode!.id)

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

    await expect.poll(() => getNodeOutputImageCount(comfyPage, nodeId)).toBe(1)

    await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
    await comfyPage.workflow.waitForWorkflowIdle()

    await tab.switchToWorkflow('outputs-test')
    await comfyPage.workflow.waitForWorkflowIdle()

    await expect
      .poll(() => getNodeOutputImageCount(comfyPage, nodeId), {
        timeout: 5_000
      })
      .toBe(1)
  })

  test('Loading a new workflow cleanly replaces the previous graph', async ({
    comfyPage
  }) => {
    test.info().annotations.push({
      type: 'regression',
      description:
        'Commit 44bb6f13 — canvas graph not reset before workflow load'
    })

    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBeGreaterThan(1)

    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    await comfyPage.nextFrame()

    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(1)

    await expect
      .poll(async () => {
        const nodes = await comfyPage.nodeOps.getNodes()
        return nodes[0]?.type
      })
      .toBe('KSampler')
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

    const widgetValuesBefore = await getWidgetValueSnapshot(comfyPage)

    expect(Object.keys(widgetValuesBefore).length).toBeGreaterThan(0)

    await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
    await comfyPage.workflow.waitForWorkflowIdle()

    await tab.switchToWorkflow('widget-state-test')
    await comfyPage.workflow.waitForWorkflowIdle()

    await expect
      .poll(() => getWidgetValueSnapshot(comfyPage), {
        timeout: 5_000
      })
      .toEqual(widgetValuesBefore)
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
      .poll(() => comfyPage.nodeOps.getNodeCount())
      .toBeGreaterThanOrEqual(2)

    const getNodeTypes = () =>
      comfyPage.page.evaluate(() =>
        window.app!.graph.nodes.map((n: { type: string }) => n.type)
      )
    await expect.poll(getNodeTypes).toContain('KSampler')
    await expect.poll(getNodeTypes).toContain('EmptyLatentImage')
    await expect
      .poll(getNodeTypes)
      .not.toContain('NonExistentCustomNode_XYZ_12345')
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

    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount())
      .toBe(initialNodeCount)
  })

  test('Exported workflow does not contain transient blob: URLs', async ({
    comfyPage
  }) => {
    test.info().annotations.push({
      type: 'regression',
      description:
        'PR #8715 — transient image URLs leaked into workflow serialization'
    })

    await expect
      .poll(async () => {
        const exportedWorkflow = await comfyPage.workflow.getExportedWorkflow()
        for (const node of exportedWorkflow.nodes) {
          if (node.widgets_values && Array.isArray(node.widgets_values)) {
            for (const value of node.widgets_values) {
              if (typeof value === 'string') {
                if (value.startsWith('blob:')) return `blob URL found: ${value}`
                if (value.includes('/api/view'))
                  return `api/view URL found: ${value}`
              }
            }
          }
        }
        return 'ok'
      })
      .toBe('ok')
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

    const linkCountBefore = await getLinkCount(comfyPage)
    expect(linkCountBefore).toBeGreaterThan(0)

    await comfyPage.menu.topbar.saveWorkflow('links-test')

    await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
    await comfyPage.workflow.waitForWorkflowIdle()

    await tab.switchToWorkflow('links-test')
    await comfyPage.workflow.waitForWorkflowIdle()

    await expect.poll(() => getLinkCount(comfyPage)).toBe(linkCountBefore)
  })

  test('Closing an unmodified inactive tab preserves both workflows', async ({
    comfyPage
  }) => {
    test.info().annotations.push({
      type: 'regression',
      description:
        'PR #10745 — closing inactive tab could corrupt the persisted file'
    })

    await comfyPage.settings.setSetting(
      'Comfy.Workflow.WorkflowTabsPosition',
      'Topbar'
    )

    const suffix = Date.now().toString(36)
    const nameA = `test-A-${suffix}`
    const nameB = `test-B-${suffix}`

    // Save the default workflow as A
    await comfyPage.menu.topbar.saveWorkflow(nameA)
    const nodeCountA = await comfyPage.nodeOps.getNodeCount()

    // Create B: duplicate, add a node, then save (unmodified after save)
    await comfyPage.command.executeCommand('Comfy.DuplicateWorkflow')
    await comfyPage.nextFrame()

    await comfyPage.page.evaluate(() => {
      window.app!.graph.add(window.LiteGraph!.createNode('Note', undefined, {}))
    })
    await comfyPage.nextFrame()
    await comfyPage.menu.topbar.saveWorkflow(nameB)

    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount())
      .toBe(nodeCountA + 1)
    const nodeCountB = await comfyPage.nodeOps.getNodeCount()

    // Switch to A (making B inactive and unmodified)
    await comfyPage.menu.topbar.getWorkflowTab(nameA).click()
    await comfyPage.workflow.waitForWorkflowIdle()
    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(nodeCountA)

    // Close inactive B via middle-click — no save dialog expected
    await comfyPage.menu.topbar.getWorkflowTab(nameB).click({
      button: 'middle'
    })
    await comfyPage.nextFrame()

    // A should still have its own content
    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(nodeCountA)

    // Reopen B from saved list
    const workflowsTab = comfyPage.menu.workflowsTab
    await workflowsTab.open()
    await workflowsTab.getPersistedItem(nameB).dblclick()
    await comfyPage.workflow.waitForWorkflowIdle()

    // B should have its original content, not A's
    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(nodeCountB)
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

    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount())
      .toBe(nodeCountA + 1)
    const nodeCountB = await comfyPage.nodeOps.getNodeCount()

    await comfyPage.page.evaluate(() => {
      const em = window.app!.extensionManager as unknown as Record<
        string,
        { activeWorkflow?: { changeTracker?: { checkState(): void } } }
      >
      em.workflow?.activeWorkflow?.changeTracker?.checkState()
    })

    await comfyPage.menu.topbar.getWorkflowTab(nameA).click()
    await comfyPage.workflow.waitForWorkflowIdle()
    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(nodeCountA)

    await comfyPage.menu.topbar.getWorkflowTab(nameB).click({
      button: 'middle'
    })

    const saveButton = comfyPage.page.getByRole('button', { name: 'Save' })
    await saveButton.waitFor({ state: 'visible' })
    await saveButton.click()
    await comfyPage.workflow.waitForWorkflowIdle()
    await comfyPage.nextFrame()

    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(nodeCountA)

    const workflowsTab = comfyPage.menu.workflowsTab
    await workflowsTab.open()
    await workflowsTab.getPersistedItem(nameB).dblclick()
    await comfyPage.workflow.waitForWorkflowIdle()

    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(nodeCountB)
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

    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(1)

    await comfyPage.menu.topbar.getWorkflowTab(nameA).click()
    await comfyPage.workflow.waitForWorkflowIdle()
    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(nodeCountA)

    await comfyPage.menu.topbar
      .getWorkflowTab('Unsaved Workflow')
      .click({ button: 'middle' })

    await comfyPage.confirmDialog.click('save')

    const saveDialog = comfyPage.menu.topbar.getSaveDialog()
    await saveDialog.waitFor({ state: 'visible' })
    await saveDialog.fill(nameB)
    await comfyPage.page.keyboard.press('Enter')
    await comfyPage.workflow.waitForWorkflowIdle()
    await comfyPage.nextFrame()

    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(nodeCountA)

    const workflowsTab = comfyPage.menu.workflowsTab
    await workflowsTab.open()
    await workflowsTab.getPersistedItem(nameB).dblclick()
    await comfyPage.workflow.waitForWorkflowIdle()

    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(1)
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

    const getSplitterSizes = () =>
      comfyPage.page.evaluate(() => {
        const raw = localStorage.getItem('Comfy.Splitter.MainSplitter')
        return raw ? (JSON.parse(raw) as number[]) : null
      })

    await expect
      .poll(async () => {
        const sizes = await getSplitterSizes()
        if (!Array.isArray(sizes)) return 'not an array'
        for (const size of sizes) {
          if (typeof size !== 'number') return `non-number entry: ${size}`
          if (size < 0) return `negative size: ${size}`
          if (Number.isNaN(size)) return `NaN entry`
        }
        return 'ok'
      })
      .toBe('ok')

    await expect
      .poll(async () => {
        const sizes = await getSplitterSizes()
        if (!sizes) return 0
        return sizes.reduce((a, b) => a + b, 0)
      })
      .toBeGreaterThan(90)

    await expect
      .poll(async () => {
        const sizes = await getSplitterSizes()
        if (!sizes) return Infinity
        return sizes.reduce((a, b) => a + b, 0)
      })
      .toBeLessThanOrEqual(101)
  })
})