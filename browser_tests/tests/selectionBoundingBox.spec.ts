import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { measureSelectionBounds } from '@e2e/fixtures/helpers/boundsUtils'
import type { NodeReference } from '@e2e/fixtures/utils/litegraphUtils'

const SUBGRAPH_ID = '2'
const REGULAR_ID = '3'
const WORKFLOW = 'selection/subgraph-with-regular-node'

type Layout = { ref: [number, number]; target: [number, number] }
const LAYOUTS: Record<string, Layout> = {
  'bottom-left': { ref: [200, 100], target: [150, 500] },
  'bottom-right': { ref: [100, 100], target: [600, 500] }
}

type NodeType = 'subgraph' | 'regular'
type NodeState = 'expanded' | 'collapsed'
type Position = 'bottom-left' | 'bottom-right'

function getTargetId(type: NodeType): string {
  return type === 'subgraph' ? SUBGRAPH_ID : REGULAR_ID
}

function getRefId(type: NodeType): string {
  return type === 'subgraph' ? REGULAR_ID : SUBGRAPH_ID
}

async function userToggleBypass(comfyPage: ComfyPage, nodeRef: NodeReference) {
  await nodeRef.click('title')
  await comfyPage.keyboard.bypass()
}

async function assertSelectionEncompassesNodes(
  page: Page,
  comfyPage: ComfyPage,
  nodeIds: string[]
) {
  await comfyPage.canvas.press('Control+a')
  await expect
    .poll(() => comfyPage.nodeOps.getSelectedGraphNodesCount())
    .toBe(2)
  await comfyPage.nextFrame()

  const result = await measureSelectionBounds(page, nodeIds)
  expect(result.selectionBounds).not.toBeNull()

  const sel = result.selectionBounds!
  const selRight = sel.x + sel.w
  const selBottom = sel.y + sel.h

  for (const nodeId of nodeIds) {
    const vis = result.nodeVisualBounds[nodeId]
    expect(vis).toBeDefined()

    expect(sel.x).toBeLessThanOrEqual(vis.x)
    expect(selRight).toBeGreaterThanOrEqual(vis.x + vis.w)
    expect(sel.y).toBeLessThanOrEqual(vis.y)
    expect(selBottom).toBeGreaterThanOrEqual(vis.y + vis.h)
  }
}

test.describe(
  'Selection bounding box (Vue mode)',
  { tag: ['@canvas', '@node'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await comfyPage.workflow.loadWorkflow(WORKFLOW)
      await comfyPage.vueNodes.waitForNodes()
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    const vueCases: ReadonlyArray<{
      type: NodeType
      state: NodeState
      pos: Position
    }> = [
      { type: 'subgraph', state: 'expanded', pos: 'bottom-left' },
      { type: 'subgraph', state: 'expanded', pos: 'bottom-right' },
      { type: 'subgraph', state: 'collapsed', pos: 'bottom-left' },
      { type: 'subgraph', state: 'collapsed', pos: 'bottom-right' },
      { type: 'regular', state: 'expanded', pos: 'bottom-left' },
      { type: 'regular', state: 'expanded', pos: 'bottom-right' },
      { type: 'regular', state: 'collapsed', pos: 'bottom-left' },
      { type: 'regular', state: 'collapsed', pos: 'bottom-right' }
    ]

    for (const { type, state, pos } of vueCases) {
      test(`${type} node (${state}) at ${pos}: selection bounds encompass node`, async ({
        comfyPage
      }) => {
        const targetId = getTargetId(type)
        const refId = getRefId(type)

        await comfyPage.nodeOps.repositionNodes({
          [refId]: LAYOUTS[pos].ref,
          [targetId]: LAYOUTS[pos].target
        })
        await comfyPage.nextFrame()
        await comfyPage.vueNodes.waitForNodes()
        await comfyPage.vueNodes.getNodeLocator(targetId).waitFor()
        await comfyPage.vueNodes.getNodeLocator(refId).waitFor()

        if (state === 'collapsed') {
          const nodeRef = await comfyPage.nodeOps.getNodeRefById(targetId)
          await nodeRef.toggleCollapse()
          await expect.poll(() => nodeRef.isCollapsed()).toBe(true)
        }

        await assertSelectionEncompassesNodes(comfyPage.page, comfyPage, [
          refId,
          targetId
        ])
      })
    }
  }
)

test.describe(
  'Selection bounding box (Vue mode) — collapsed node bypass toggle',
  { tag: ['@canvas', '@node'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await comfyPage.workflow.loadWorkflow(WORKFLOW)
      await comfyPage.vueNodes.waitForNodes()
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    test('collapsed node narrows bounding box when bypass is removed', async ({
      comfyPage
    }) => {
      await comfyPage.nodeOps.repositionNodes({
        [SUBGRAPH_ID]: LAYOUTS['bottom-right'].ref,
        [REGULAR_ID]: LAYOUTS['bottom-right'].target
      })
      await comfyPage.nextFrame()
      await comfyPage.vueNodes.waitForNodes()

      const nodeRef = await comfyPage.nodeOps.getNodeRefById(REGULAR_ID)
      await userToggleBypass(comfyPage, nodeRef)
      await expect.poll(() => nodeRef.isBypassed()).toBe(true)
      await nodeRef.toggleCollapse()
      await expect.poll(() => nodeRef.isCollapsed()).toBe(true)

      await userToggleBypass(comfyPage, nodeRef)
      await expect.poll(() => nodeRef.isBypassed()).toBe(false)
      await comfyPage.nextFrame()

      await assertSelectionEncompassesNodes(comfyPage.page, comfyPage, [
        SUBGRAPH_ID,
        REGULAR_ID
      ])
    })

    test('collapsed node widens bounding box when bypass is added', async ({
      comfyPage
    }) => {
      await comfyPage.nodeOps.repositionNodes({
        [SUBGRAPH_ID]: LAYOUTS['bottom-right'].ref,
        [REGULAR_ID]: LAYOUTS['bottom-right'].target
      })
      await comfyPage.nextFrame()
      await comfyPage.vueNodes.waitForNodes()

      const nodeRef = await comfyPage.nodeOps.getNodeRefById(REGULAR_ID)
      await nodeRef.toggleCollapse()
      await expect.poll(() => nodeRef.isCollapsed()).toBe(true)

      await userToggleBypass(comfyPage, nodeRef)
      await expect.poll(() => nodeRef.isBypassed()).toBe(true)
      await comfyPage.nextFrame()

      await assertSelectionEncompassesNodes(comfyPage.page, comfyPage, [
        SUBGRAPH_ID,
        REGULAR_ID
      ])
    })
  }
)

test.describe(
  'Selection bounding box (legacy mode)',
  { tag: ['@canvas', '@node'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
      await comfyPage.workflow.loadWorkflow(WORKFLOW)
      await comfyPage.nextFrame()
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    const legacyCases: ReadonlyArray<{ state: NodeState; pos: Position }> = [
      { state: 'expanded', pos: 'bottom-left' },
      { state: 'expanded', pos: 'bottom-right' },
      { state: 'collapsed', pos: 'bottom-left' },
      { state: 'collapsed', pos: 'bottom-right' }
    ]

    for (const { state, pos } of legacyCases) {
      test(`legacy node (${state}) at ${pos}: selection bounds encompass node`, async ({
        comfyPage
      }) => {
        await comfyPage.nodeOps.repositionNodes({
          [SUBGRAPH_ID]: LAYOUTS[pos].ref,
          [REGULAR_ID]: LAYOUTS[pos].target
        })
        await comfyPage.nextFrame()

        if (state === 'collapsed') {
          const nodeRef = await comfyPage.nodeOps.getNodeRefById(REGULAR_ID)
          await nodeRef.toggleCollapse()
          await expect.poll(() => nodeRef.isCollapsed()).toBe(true)
        }

        await assertSelectionEncompassesNodes(comfyPage.page, comfyPage, [
          SUBGRAPH_ID,
          REGULAR_ID
        ])
      })
    }
  }
)
