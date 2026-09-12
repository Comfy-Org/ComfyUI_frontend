import { readFileSync } from 'fs'

import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { dismissErrorOverlay } from '@e2e/fixtures/helpers/ErrorsTabHelper'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'

import { toNodeId } from '@/types/nodeId'

const generateUniqueFilename = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const waitForWorkflowTabState = async (comfyPage: ComfyPage, minPaths = 2) => {
  await comfyPage.page.waitForFunction((expectedMinPaths) => {
    let hasActivePath = false
    let hasOpenPaths = false

    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i)
      if (key?.startsWith('Comfy.Workflow.ActivePath:')) {
        hasActivePath = true
      }
      if (!key?.startsWith('Comfy.Workflow.OpenPaths:')) {
        continue
      }

      const raw = window.sessionStorage.getItem(key)
      if (!raw) continue

      try {
        const state = JSON.parse(raw) as { paths?: unknown[] }
        hasOpenPaths =
          Array.isArray(state.paths) && state.paths.length >= expectedMinPaths
        if (hasActivePath && hasOpenPaths) return true
      } catch {
        return false
      }
    }

    return hasActivePath && hasOpenPaths
  }, minPaths)
}

type NodeRef = NonNullable<
  Awaited<ReturnType<ComfyPage['nodeOps']['getFirstNodeRef']>>
>

const getRequiredFirstNodeRef = async (
  comfyPage: ComfyPage,
  message: string
): Promise<NodeRef> => {
  const node = await comfyPage.nodeOps.getFirstNodeRef()
  expect(node, message).toBeDefined()
  if (!node) throw new Error(message)
  return node
}

const makeActivePathStale = async (
  comfyPage: ComfyPage,
  staleWorkflowName: string,
  activeWorkflowName: string
) => {
  // Intentionally desync ActivePath from OpenPaths to exercise stale pointer recovery.
  await comfyPage.page.evaluate(
    ([staleName, activeName]) => {
      const findStorageKey = (prefix: string) => {
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i)
          if (key?.startsWith(prefix)) return key
        }
        throw new Error(`Missing ${prefix} persistence key`)
      }

      const activePathKey = findStorageKey('Comfy.Workflow.ActivePath:')
      const openPathsKey = findStorageKey('Comfy.Workflow.OpenPaths:')
      const activePointer = JSON.parse(
        window.sessionStorage.getItem(activePathKey)!
      ) as { path: string }
      const openPointer = JSON.parse(
        window.sessionStorage.getItem(openPathsKey)!
      ) as { paths: string[]; activeIndex: number }
      const pathForName = (name: string) => {
        const path = openPointer.paths.find((candidate) =>
          candidate.endsWith(`${name}.json`)
        )
        if (!path) throw new Error(`Missing stored path for ${name}`)
        return path
      }

      const stalePath = pathForName(staleName)
      const activePath = pathForName(activeName)
      activePointer.path = stalePath
      openPointer.paths = [stalePath, activePath]
      openPointer.activeIndex = 1

      window.sessionStorage.setItem(
        activePathKey,
        JSON.stringify(activePointer)
      )
      window.sessionStorage.setItem(openPathsKey, JSON.stringify(openPointer))
    },
    [staleWorkflowName, activeWorkflowName]
  )
}

async function getNodeOutputImageCount(
  comfyPage: ComfyPage,
  nodeId: string
): Promise<number> {
  return await comfyPage.page.evaluate(
    (id) => window.app!.nodeOutputs[id]?.images?.length ?? 0,
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
    return Object.keys(window.app!.graph.links).length
  })
}

async function getLinkEndpoints(comfyPage: ComfyPage) {
  return await comfyPage.page.evaluate(() =>
    [...window.app!.graph.links.values()].map(
      (link) =>
        [
          String(link.origin_id),
          link.origin_slot,
          String(link.target_id),
          link.target_slot
        ] as const
    )
  )
}

async function getNodeTitle(comfyPage: ComfyPage, nodeId: number) {
  return comfyPage.page.evaluate((id) => {
    const node = window.app!.graph.getNodeById(id)
    if (!node) throw new Error(`Node ${id} not found`)
    return node.title
  }, toNodeId(nodeId))
}

async function getPersistenceSnapshot(comfyPage: ComfyPage) {
  const workflow = await comfyPage.workflow.getExportedWorkflow()
  return {
    nodes: workflow.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      title: node.title,
      pos: node.pos,
      size: node.size,
      flags: node.flags,
      widgets_values: node.widgets_values
    })),
    links: workflow.links,
    groups: workflow.groups,
    reroutes: workflow.extra?.reroutes
  }
}

async function enrichPersistenceWorkflow(comfyPage: ComfyPage) {
  const workflow = await comfyPage.workflow.getExportedWorkflow()
  const sourceNodes = workflow.nodes.slice(0, 3)
  const extraNodes = sourceNodes.map((node, index) => ({
    ...structuredClone(node),
    id: 10 + index,
    pos: [node.pos[0], node.pos[1] + 700] as [number, number],
    flags: index === 0 ? { ...node.flags, collapsed: true } : node.flags,
    inputs: node.inputs?.map((input) => ({ ...input, link: null })),
    outputs: node.outputs?.map((output) => ({ ...output, links: [] }))
  }))
  workflow.nodes.push(...extraNodes)
  workflow.groups = [
    {
      id: 1,
      title: 'Prompt controls',
      bounding: [380, 150, 500, 450],
      color: '#3f789e',
      font_size: 24,
      flags: {}
    },
    {
      id: 2,
      title: 'Generated copies',
      bounding: [380, 850, 500, 450],
      color: '#3f789e',
      font_size: 24,
      flags: {}
    }
  ]
  await comfyPage.workflow.loadGraphData(workflow)
}

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

  for (const vueNodesEnabled of [false, true]) {
    test(`missing custom node keeps its placeholder and endpoint tuples with Vue Nodes ${vueNodesEnabled ? 'enabled' : 'disabled'}`, async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.VueNodes.Enabled',
        vueNodesEnabled
      )
      await comfyPage.settings.setSetting(
        'Comfy.RightSidePanel.ShowErrorsTab',
        true
      )
      await comfyPage.workflow.loadWorkflow('missing/named_unknown_connected')
      await dismissErrorOverlay(comfyPage)

      const expectedLinks = [
        [1, 10, 0, 1, 0, 'IMAGE'],
        [2, 1, 0, 11, 0, 'IMAGE']
      ]
      const assertMissingGraph = async () => {
        const snapshot = await getPersistenceSnapshot(comfyPage)
        expect(snapshot.links).toEqual(expectedLinks)
        expect(snapshot.nodes.find((node) => node.id === 1)).toMatchObject({
          type: 'UNKNOWN NODE',
          widgets_values: ['preserve this missing-pack value']
        })
        if (vueNodesEnabled) {
          await expect(comfyPage.vueNodes.getNodeInnerWrapper('1')).toHaveClass(
            /ring-destructive-background/
          )
        }
      }

      await assertMissingGraph()
      const name = `missing-connected-${generateUniqueFilename()}`
      await comfyPage.menu.topbar.saveWorkflowAs(name)
      await comfyPage.workflow.reloadAndWaitForApp()
      await comfyPage.workflow.waitForWorkflowIdle()
      await assertMissingGraph()
    })

    test(`widget value and node title edited in the UI survive saved reload with Vue Nodes ${vueNodesEnabled ? 'enabled' : 'disabled'}`, async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.VueNodes.Enabled',
        vueNodesEnabled
      )
      await comfyPage.settings.setSetting(
        'Comfy.Node.DoubleClickTitleToEdit',
        true
      )
      await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
      await fitToViewInstant(comfyPage)
      const node = await comfyPage.nodeOps.getNodeRefById(3)
      const originalTitle = await getNodeTitle(comfyPage, 3)
      const seed = await node.getWidgetByName('seed')
      const originalSeed = await seed.getValue()
      const savedSeed = 123456789

      const rename = async () => {
        if (vueNodesEnabled) {
          await (
            await comfyPage.vueNodes.getFixtureByTitle(originalTitle)
          ).setTitle('Renamed node')
        } else {
          await comfyPage.canvasOps.mouseDblclickAt(
            await node.getTitlePosition()
          )
          await comfyPage.titleEditor.expectVisible()
          await comfyPage.titleEditor.setTitle('Renamed node')
        }
        await expect.poll(() => getNodeTitle(comfyPage, 3)).toBe('Renamed node')
      }

      await rename()
      await node.click('title')
      await comfyPage.keyboard.undo()
      await expect.poll(() => getNodeTitle(comfyPage, 3)).toBe(originalTitle)
      await rename()

      if (vueNodesEnabled) {
        const seedInput = comfyPage.page
          .locator('[data-node-id="3"]')
          .getByRole('spinbutton')
          .first()
        await seedInput.fill(String(savedSeed))
        await seedInput.press('Enter')
        await expect(seedInput).toHaveValue(String(savedSeed))
      } else {
        await seed.click()
        await comfyPage.page.keyboard.press('ControlOrMeta+A')
        await comfyPage.page.keyboard.type(String(savedSeed))
        await comfyPage.page.keyboard.press('Enter')
      }
      await expect.poll(() => seed.getValue()).toBe(savedSeed)

      const name = `renamed-node-${generateUniqueFilename()}`
      await comfyPage.menu.topbar.saveWorkflowAs(name)
      await comfyPage.workflow.reloadAndWaitForApp()
      const tab = comfyPage.menu.workflowsTab
      await tab.open()
      await tab.getPersistedItem(name).dblclick()
      await tab.close()
      await comfyPage.workflow.waitForWorkflowIdle()
      await expect.poll(() => getNodeTitle(comfyPage, 3)).toBe('Renamed node')
      const reloadedNode = await comfyPage.nodeOps.getNodeRefById(3)
      await expect
        .poll(async () =>
          (await reloadedNode.getWidgetByName('seed')).getValue()
        )
        .toBe(savedSeed)
      expect(await getNodeTitle(comfyPage, 3)).not.toBe(originalTitle)
      expect(
        await (await reloadedNode.getWidgetByName('seed')).getValue()
      ).not.toBe(originalSeed)
      if (vueNodesEnabled) {
        await expect(
          comfyPage.page.locator('[data-node-id="3"]').getByText('Renamed node')
        ).toBeVisible()
        await expect(
          comfyPage.page
            .locator('[data-node-id="3"]')
            .getByRole('spinbutton')
            .first()
        ).toHaveValue(String(savedSeed))
      } else {
        await comfyPage.canvasOps.mouseDblclickAt(
          await reloadedNode.getTitlePosition()
        )
        await comfyPage.titleEditor.expectVisible()
        await expect(comfyPage.titleEditor.input).toHaveValue('Renamed node')
        await comfyPage.titleEditor.cancel()
        const reloadedSeed = await reloadedNode.getWidgetByName('seed')
        await reloadedSeed.click()
        await expect(
          comfyPage.page.locator('.graphdialog input[type="text"]')
        ).toHaveValue(String(savedSeed))
        await comfyPage.page.keyboard.press('Escape')
      }
    })

    test(`copied links keep copied endpoints after saved reload with Vue Nodes ${vueNodesEnabled ? 'enabled' : 'disabled'}`, async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.VueNodes.Enabled',
        vueNodesEnabled
      )
      await comfyPage.workflow.loadWorkflow('default')
      await fitToViewInstant(comfyPage)

      const before = await getPersistenceSnapshot(comfyPage)
      const originalIds = new Set(before.nodes.map(({ id }) => String(id)))
      const originalEndpoints = await getLinkEndpoints(comfyPage)
      expect(originalIds.size).toBeGreaterThan(0)
      expect(originalEndpoints.length).toBeGreaterThan(0)
      await comfyPage.canvas.click()
      await comfyPage.keyboard.selectAll()
      await comfyPage.clipboard.copy()
      await comfyPage.clipboard.paste()
      await comfyPage.nextFrame()

      const copied = await getPersistenceSnapshot(comfyPage)
      const copiedIds = new Set(
        copied.nodes
          .map(({ id }) => String(id))
          .filter((id) => !originalIds.has(id))
      )
      expect(copiedIds.size).toBe(originalIds.size)
      const copiedEndpoints = (await getLinkEndpoints(comfyPage)).filter(
        ([originId, , targetId]) =>
          copiedIds.has(originId) || copiedIds.has(targetId)
      )
      expect(copiedEndpoints).toHaveLength(originalEndpoints.length)
      for (const [originId, , targetId] of copiedEndpoints) {
        expect(copiedIds.has(originId)).toBe(true)
        expect(copiedIds.has(targetId)).toBe(true)
        expect(originalIds.has(originId)).toBe(false)
        expect(originalIds.has(targetId)).toBe(false)
      }

      const expectedEndpointTuples = await getLinkEndpoints(comfyPage)
      expect(expectedEndpointTuples).toHaveLength(originalEndpoints.length * 2)
      expect(expectedEndpointTuples).toEqual(
        expect.arrayContaining(originalEndpoints)
      )
      const name = `copied-links-${generateUniqueFilename()}`
      await comfyPage.menu.topbar.saveWorkflowAs(name)
      await comfyPage.workflow.reloadAndWaitForApp()
      const tab = comfyPage.menu.workflowsTab
      await tab.open()
      await tab.getPersistedItem(name).dblclick()
      await tab.close()
      await comfyPage.workflow.waitForWorkflowIdle()

      const reloadedEndpointTuples = await getLinkEndpoints(comfyPage)
      expect(reloadedEndpointTuples).toEqual(expectedEndpointTuples)
      for (const [originId, , targetId] of reloadedEndpointTuples.filter(
        ([candidateOriginId, , candidateTargetId]) =>
          copiedIds.has(candidateOriginId) || copiedIds.has(candidateTargetId)
      )) {
        expect(copiedIds.has(originId)).toBe(true)
        expect(copiedIds.has(targetId)).toBe(true)
      }
    })

    test(`Save As and export/import preserve the exact graph with Vue Nodes ${vueNodesEnabled ? 'enabled' : 'disabled'}`, async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting(
        'Comfy.VueNodes.Enabled',
        vueNodesEnabled
      )
      await comfyPage.workflow.loadWorkflow(
        'reroute/single-native-reroute-default-workflow'
      )
      await enrichPersistenceWorkflow(comfyPage)

      const positivePrompt =
        'Changed through the UI before persistence: café & <exact>.'
      const positiveWidth = 768
      const positiveScheduler = 'karras'
      const positiveNode = await comfyPage.nodeOps.getNodeRefById(6)
      const positiveText = await positiveNode.getWidgetByName('text')
      const textBox = vueNodesEnabled
        ? comfyPage.page
            .locator('[data-node-id="6"]')
            .getByRole('textbox', { name: 'text', exact: true })
        : comfyPage.page
            .getByRole('textbox', { name: 'text', exact: true })
            .nth(1)
      await textBox.fill(positivePrompt)
      await textBox.blur()

      const latentNode = await comfyPage.nodeOps.getNodeRefById(5)
      const width = await latentNode.getWidgetByName('width')
      if (vueNodesEnabled) {
        const widthInput = comfyPage.page
          .locator('[data-node-id="5"]')
          .getByRole('spinbutton')
          .first()
        await widthInput.fill(String(positiveWidth))
        await widthInput.press('Enter')
      } else {
        await width.click()
        await comfyPage.page.keyboard.press('ControlOrMeta+A')
        await comfyPage.page.keyboard.type(String(positiveWidth))
        await comfyPage.page.keyboard.press('Enter')
      }

      const samplerNode = await comfyPage.nodeOps.getNodeRefById(3)
      const scheduler = await samplerNode.getWidgetByName('scheduler')
      if (vueNodesEnabled) {
        await comfyPage.page
          .locator('[data-node-id="3"]')
          .getByRole('combobox', { name: 'scheduler' })
          .click()
        await comfyPage.page
          .getByRole('combobox', { name: 'Search' })
          .fill(positiveScheduler)
        await comfyPage.page
          .getByRole('option', { name: positiveScheduler, exact: true })
          .click()
      } else {
        await scheduler.click()
        await comfyPage.page
          .getByRole('menuitem', { name: positiveScheduler, exact: true })
          .click()
      }
      await expect.poll(() => positiveText.getValue()).toBe(positivePrompt)
      await expect.poll(() => width.getValue()).toBe(positiveWidth)
      await expect.poll(() => scheduler.getValue()).toBe(positiveScheduler)

      const expected = await getPersistenceSnapshot(comfyPage)
      if (!expected.links || !expected.groups) {
        throw new Error('Persistence workflow is missing links or groups')
      }
      expect(expected.nodes.length).toBeGreaterThanOrEqual(10)
      expect(expected.links.length).toBeGreaterThan(0)
      expect(expected.groups.length).toBeGreaterThanOrEqual(2)
      expect(expected.reroutes?.length).toBeGreaterThan(0)
      expect(expected.nodes.some((node) => node.flags.collapsed === true)).toBe(
        true
      )

      const suffix = generateUniqueFilename()
      const nameA = `persistence-A-${suffix}`
      const nameB = `persistence-B-${suffix}`
      await comfyPage.menu.topbar.saveWorkflow(nameA)
      await comfyPage.menu.topbar.saveWorkflowAs(nameB)

      const tab = comfyPage.menu.workflowsTab
      await tab.open()
      for (const name of [nameA, nameB]) {
        await tab.getPersistedItem(name).dblclick()
        await comfyPage.workflow.waitForWorkflowIdle()
        expect(await getPersistenceSnapshot(comfyPage)).toEqual(expected)
        const reloadedSampler = await comfyPage.nodeOps.getNodeRefById(3)
        await expect
          .poll(async () =>
            (await reloadedSampler.getWidgetByName('scheduler')).getValue()
          )
          .toBe(positiveScheduler)
        if (vueNodesEnabled) {
          await expect(
            comfyPage.page
              .locator('[data-node-id="3"]')
              .getByRole('combobox')
              .filter({ hasText: positiveScheduler })
          ).toBeVisible()
        }
      }

      const downloadPromise = comfyPage.page.waitForEvent('download')
      await comfyPage.menu.topbar.exportWorkflow(`persistence-${suffix}.json`)
      const download = await downloadPromise
      const downloadPath = await download.path()
      expect(downloadPath).not.toBeNull()
      if (!downloadPath) throw new Error('Exported workflow has no local path')

      await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
      await comfyPage.workflow.waitForWorkflowIdle()
      await comfyPage.workflowUploadInput.setInputFiles({
        name: `persistence-${suffix}.json`,
        mimeType: 'application/json',
        buffer: readFileSync(downloadPath)
      })
      await comfyPage.workflow.waitForWorkflowIdle()
      expect(await getPersistenceSnapshot(comfyPage)).toEqual(expected)
    })
  }

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

    const firstNode = await getRequiredFirstNodeRef(
      comfyPage,
      'First node should be available after loading the default workflow'
    )
    const nodeId = String(firstNode.id)

    // Simulate node outputs as if execution completed
    await comfyPage.page.evaluate((id) => {
      const outputStore = window.app!.nodeOutputs
      outputStore[id] = {
        images: [{ filename: 'test.png', subfolder: '', type: 'output' }]
      }
    }, nodeId)

    // Trigger changeTracker to capture current state including outputs
    await comfyPage.page.evaluate(() => {
      const em = window.app!.extensionManager as unknown as Record<
        string,
        { activeWorkflow?: { changeTracker: { captureCanvasState(): void } } }
      >
      em.workflow.activeWorkflow?.changeTracker.captureCanvasState()
    })

    await expect.poll(() => getNodeOutputImageCount(comfyPage, nodeId)).toBe(1)

    await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
    await comfyPage.workflow.waitForWorkflowIdle()

    await tab.switchToWorkflow('outputs-test')
    await comfyPage.workflow.waitForWorkflowIdle()

    await expect.poll(() => getNodeOutputImageCount(comfyPage, nodeId)).toBe(1)
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

    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(1)

    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => window.app!.graph.nodes[0]?.type)
      )
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

    // Read widget values via page.evaluate — these are internal LiteGraph
    // state not exposed through DOM
    const widgetValuesBefore = await getWidgetValueSnapshot(comfyPage)

    expect(Object.keys(widgetValuesBefore).length).toBeGreaterThan(0)

    await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
    await comfyPage.workflow.waitForWorkflowIdle()

    await tab.switchToWorkflow('widget-state-test')
    await comfyPage.workflow.waitForWorkflowIdle()

    await expect
      .poll(() => getWidgetValueSnapshot(comfyPage))
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

    // Known nodes and an error-marked placeholder for the unknown node load.
    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(3)

    const getNodes = () =>
      comfyPage.page.evaluate(() =>
        window.app!.graph.nodes.map((node) => ({
          type: node.type,
          hasErrors: node.has_errors
        }))
      )
    await expect
      .poll(getNodes)
      .toContainEqual(expect.objectContaining({ type: 'KSampler' }))
    await expect
      .poll(getNodes)
      .toContainEqual(expect.objectContaining({ type: 'EmptyLatentImage' }))
    await expect.poll(getNodes).toContainEqual({
      type: 'NonExistentCustomNode_XYZ_12345',
      hasErrors: true
    })
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

    await comfyPage.settings.setSetting('Comfy.Locale', 'en')

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

  test('Restores saved workflow drafts from inactive restored tabs', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting('Comfy.Workflow.Persist', true)
    await comfyPage.settings.setSetting(
      'Comfy.Workflow.WorkflowTabsPosition',
      'Topbar'
    )

    const workflowA = generateUniqueFilename()
    const workflowB = generateUniqueFilename()

    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    await fitToViewInstant(comfyPage)
    await comfyPage.menu.topbar.saveWorkflow(workflowA)

    const firstNode = await getRequiredFirstNodeRef(
      comfyPage,
      'First node should be available after loading single_ksampler'
    )
    await firstNode.centerOnNode()
    const draftSaveStartedAt = Date.now()
    await firstNode.toggleCollapse()
    expect(await firstNode.isCollapsed()).toBe(true)
    await comfyPage.workflow.waitForDraftIndexUpdatedSince(draftSaveStartedAt)

    await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
    await comfyPage.menu.topbar.saveWorkflow(workflowB)
    await waitForWorkflowTabState(comfyPage)
    await makeActivePathStale(comfyPage, workflowA, workflowB)

    await comfyPage.workflow.reloadAndWaitForApp()
    await expect
      .poll(() => comfyPage.menu.topbar.getActiveTabName())
      .toBe(workflowB)

    const tabs = await comfyPage.menu.topbar.getTabNames()
    expect(tabs).toEqual(expect.arrayContaining([workflowA, workflowB]))
    expect(tabs.indexOf(workflowA)).toBeLessThan(tabs.indexOf(workflowB))

    await comfyPage.menu.topbar.getWorkflowTab(workflowA).click()
    await comfyPage.workflow.waitForWorkflowIdle()
    await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(1)

    const restoredNode = await getRequiredFirstNodeRef(
      comfyPage,
      'Restored node should be available after switching back to workflow A'
    )
    expect(await restoredNode.isCollapsed()).toBe(true)
    await expect(comfyPage.toast.toastErrors).toHaveCount(0)
  })

  test('Flushes a pending draft edit before an immediate reload', async ({
    comfyPage
  }) => {
    test.info().annotations.push({
      type: 'regression',
      description:
        'FE-1484 — refreshing inside the persistence debounce window lost the latest workflow edit'
    })

    await comfyPage.settings.setSetting('Comfy.Workflow.Persist', true)
    await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    await fitToViewInstant(comfyPage)

    const firstNode = await getRequiredFirstNodeRef(
      comfyPage,
      'First node should be available after loading single_ksampler'
    )
    await firstNode.centerOnNode()

    const baselineSaveStartedAt = Date.now()
    await firstNode.toggleCollapse()
    await expect.poll(() => firstNode.isCollapsed()).toBe(true)
    await comfyPage.workflow.waitForDraftIndexUpdatedSince(
      baselineSaveStartedAt
    )

    await firstNode.toggleCollapse()
    await comfyPage.workflow.reloadAndWaitForApp()

    const restoredNode = await getRequiredFirstNodeRef(
      comfyPage,
      'First node should be restored after the immediate reload'
    )
    await expect.poll(() => restoredNode.isCollapsed()).toBe(false)
  })

  test('Closing an inactive tab with save preserves its own content', async ({
    comfyPage
  }) => {
    test.info().annotations.push({
      type: 'regression',
      description:
        'PR #10745 — saveWorkflow called captureCanvasState on inactive tab, serializing the active graph instead'
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

    // Create B: duplicate and save
    await comfyPage.command.executeCommand('Comfy.DuplicateWorkflow')
    await comfyPage.menu.topbar.saveWorkflow(nameB)

    // Add a Note node in B to mark it as modified
    await comfyPage.page.evaluate(() => {
      window.app!.graph.add(window.LiteGraph!.createNode('Note', undefined, {}))
    })
    await comfyPage.nextFrame()

    await expect
      .poll(() => comfyPage.nodeOps.getNodeCount())
      .toBe(nodeCountA + 1)
    const nodeCountB = await comfyPage.nodeOps.getNodeCount()

    // Trigger captureCanvasState so isModified is set
    await comfyPage.page.evaluate(() => {
      const em = window.app!.extensionManager as unknown as Record<
        string,
        { activeWorkflow?: { changeTracker: { captureCanvasState(): void } } }
      >
      em.workflow.activeWorkflow?.changeTracker.captureCanvasState()
    })

    // Switch to A via topbar tab (making B inactive)
    await comfyPage.menu.topbar.getWorkflowTab(nameA).click()
    await comfyPage.workflow.waitForWorkflowIdle()
    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(nodeCountA)

    // Close inactive B tab via middle-click — triggers "Save before closing?"
    await comfyPage.menu.topbar.getWorkflowTab(nameB).click({
      button: 'middle'
    })

    // Click "Save" in the dirty close dialog
    const saveButton = comfyPage.page.getByRole('button', { name: 'Save' })
    await saveButton.waitFor({ state: 'visible' })
    await saveButton.click()
    await comfyPage.workflow.waitForWorkflowIdle()
    await comfyPage.nextFrame()

    // Verify we're still on A with A's content
    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(nodeCountA)

    // Re-open B from sidebar saved list
    const workflowsTab = comfyPage.menu.workflowsTab
    await workflowsTab.open()
    await workflowsTab.getPersistedItem(nameB).dblclick()
    await comfyPage.workflow.waitForWorkflowIdle()

    // B should have the extra Note node we added, not A's node count
    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(nodeCountB)
  })

  test('Closing an inactive unsaved tab with save preserves its own content', async ({
    comfyPage
  }) => {
    test.info().annotations.push({
      type: 'regression',
      description:
        'PR #10745 — saveWorkflowAs called captureCanvasState on inactive temp tab, serializing the active graph'
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

    // Create B as an unsaved workflow with a Note node
    await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')

    await comfyPage.page.evaluate(() => {
      window.app!.graph.add(window.LiteGraph!.createNode('Note', undefined, {}))
    })
    await comfyPage.nextFrame()

    // Trigger captureCanvasState so isModified is set
    await comfyPage.page.evaluate(() => {
      const em = window.app!.extensionManager as unknown as Record<
        string,
        { activeWorkflow?: { changeTracker: { captureCanvasState(): void } } }
      >
      em.workflow.activeWorkflow?.changeTracker.captureCanvasState()
    })

    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(1)

    // Switch to A via topbar tab (making unsaved B inactive)
    await comfyPage.menu.topbar.getWorkflowTab(nameA).click()
    await comfyPage.workflow.waitForWorkflowIdle()
    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(nodeCountA)

    // Close inactive unsaved B tab — triggers "Save before closing?"
    await comfyPage.menu.topbar
      .getWorkflowTab('Unsaved Workflow')
      .click({ button: 'middle' })

    // Click "Save" in the dirty close dialog
    await comfyPage.confirmDialog.click('save')

    // Fill in the filename dialog
    const saveDialog = comfyPage.menu.topbar.getSaveDialog()
    await saveDialog.waitFor({ state: 'visible' })
    await saveDialog.fill(nameB)
    await comfyPage.page.keyboard.press('Enter')
    await comfyPage.workflow.waitForWorkflowIdle()
    await comfyPage.nextFrame()

    // Verify we're still on A with A's content
    await expect.poll(() => comfyPage.nodeOps.getNodeCount()).toBe(nodeCountA)

    // Re-open B from sidebar saved list
    const workflowsTab = comfyPage.menu.workflowsTab
    await workflowsTab.open()
    await workflowsTab.getPersistedItem(nameB).dblclick()
    await comfyPage.workflow.waitForWorkflowIdle()

    // B should have 1 node (the Note), not A's node count
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

    // oxlint-disable-next-line comfy/no-comfy-page-setup-call -- pre-existing call, tracked by evfail-23; not fixed in this pass
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
