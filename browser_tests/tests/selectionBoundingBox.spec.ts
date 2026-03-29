import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

interface CanvasRect {
  x: number
  y: number
  w: number
  h: number
}

interface MeasureResult {
  selectionBounds: CanvasRect | null
  nodeVisualBounds: Record<string, CanvasRect>
}

// Must match the padding value passed to createBounds() in selectionBorder.ts
const SELECTION_PADDING = 10

async function measureBounds(
  page: Page,
  nodeIds: string[]
): Promise<MeasureResult> {
  return page.evaluate(
    ({ ids, padding }) => {
      const canvas = window.app!.canvas
      const ds = canvas.ds

      const selectedItems = canvas.selectedItems
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const item of selectedItems) {
        const rect = item.boundingRect
        minX = Math.min(minX, rect[0])
        minY = Math.min(minY, rect[1])
        maxX = Math.max(maxX, rect[0] + rect[2])
        maxY = Math.max(maxY, rect[1] + rect[3])
      }
      const selectionBounds =
        selectedItems.size > 0
          ? {
              x: minX - padding,
              y: minY - padding,
              w: maxX - minX + 2 * padding,
              h: maxY - minY + 2 * padding
            }
          : null

      const canvasEl = canvas.canvas as HTMLCanvasElement
      const canvasRect = canvasEl.getBoundingClientRect()
      const nodeVisualBounds: Record<string, CanvasRect> = {}

      for (const id of ids) {
        const nodeEl = document.querySelector(
          `[data-node-id="${id}"]`
        ) as HTMLElement | null
        if (!nodeEl) continue

        const domRect = nodeEl.getBoundingClientRect()
        const footerEls = nodeEl.querySelectorAll(
          '[data-testid="subgraph-enter-button"], [data-testid="node-footer"]'
        )
        let bottom = domRect.bottom
        for (const footerEl of footerEls) {
          bottom = Math.max(bottom, footerEl.getBoundingClientRect().bottom)
        }

        nodeVisualBounds[id] = {
          x: (domRect.left - canvasRect.left) / ds.scale - ds.offset[0],
          y: (domRect.top - canvasRect.top) / ds.scale - ds.offset[1],
          w: domRect.width / ds.scale,
          h: (bottom - domRect.top) / ds.scale
        }
      }

      return { selectionBounds, nodeVisualBounds }
    },
    { ids: nodeIds, padding: SELECTION_PADDING }
  ) as Promise<MeasureResult>
}

const SUBGRAPH_ID = '2'
const REGULAR_ID = '3'
const WORKFLOW = 'selection/subgraph-with-regular-node'

const REF_POS: [number, number] = [100, 100]
const TARGET_POSITIONS: Record<string, [number, number]> = {
  'bottom-left': [50, 500],
  'bottom-right': [600, 500]
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

test.describe('Selection bounding box', { tag: ['@canvas', '@node'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.workflow.loadWorkflow(WORKFLOW)
    await comfyPage.vueNodes.waitForNodes()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.canvasOps.resetView()
  })

  const nodeTypes: NodeType[] = ['subgraph', 'regular']
  const nodeStates: NodeState[] = ['expanded', 'collapsed']
  const positions: Position[] = ['bottom-left', 'bottom-right']

  for (const type of nodeTypes) {
    for (const state of nodeStates) {
      for (const pos of positions) {
        test(`${type} node (${state}) at ${pos}: selection bounds encompass node`, async ({
          comfyPage
        }) => {
          const page = comfyPage.page
          const targetId = getTargetId(type)
          const refId = getRefId(type)

          await comfyPage.nodeOps.loadWithPositions({
            [refId]: REF_POS,
            [targetId]: TARGET_POSITIONS[pos]
          })
          await comfyPage.vueNodes.waitForNodes()
          await comfyPage.vueNodes.getNodeLocator(targetId).waitFor()
          await comfyPage.vueNodes.getNodeLocator(refId).waitFor()

          if (state === 'collapsed') {
            const nodeRef = await comfyPage.nodeOps.getNodeRefById(targetId)
            await nodeRef.setCollapsed(true)
          }

          await comfyPage.canvas.press('Control+a')
          await expect
            .poll(() => comfyPage.nodeOps.getSelectedGraphNodesCount())
            .toBe(2)
          await comfyPage.nextFrame()

          const result = await measureBounds(page, [refId, targetId])
          expect(result.selectionBounds).not.toBeNull()

          const sel = result.selectionBounds!
          const vis = result.nodeVisualBounds[targetId]
          expect(vis).toBeDefined()

          const selRight = sel.x + sel.w
          const selBottom = sel.y + sel.h
          const visRight = vis.x + vis.w
          const visBottom = vis.y + vis.h

          expect(sel.x).toBeLessThanOrEqual(vis.x)
          expect(selRight).toBeGreaterThanOrEqual(visRight)
          expect(sel.y).toBeLessThanOrEqual(vis.y)
          expect(selBottom).toBeGreaterThanOrEqual(visBottom)
        })
      }
    }
  }
})
