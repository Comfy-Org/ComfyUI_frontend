import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { measureSelectionBounds } from '../fixtures/helpers/boundsUtils'

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

          await comfyPage.nodeOps.repositionNodes({
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

          const result = await measureSelectionBounds(page, [refId, targetId])
          expect(result.selectionBounds).not.toBeNull()

          const sel = result.selectionBounds!
          const selRight = sel.x + sel.w
          const selBottom = sel.y + sel.h

          for (const nodeId of [refId, targetId]) {
            const vis = result.nodeVisualBounds[nodeId]
            expect(vis).toBeDefined()

            expect(sel.x).toBeLessThanOrEqual(vis.x)
            expect(selRight).toBeGreaterThanOrEqual(vis.x + vis.w)
            expect(sel.y).toBeLessThanOrEqual(vis.y)
            expect(selBottom).toBeGreaterThanOrEqual(vis.y + vis.h)
          }
        })
      }
    }
  }
})
