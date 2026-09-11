import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'

// These cases are intentionally staged behind fixme until the stacked canvas
// slice lands on main: https://github.com/Comfy-Org/ComfyUI_frontend/pull/16186
test.describe(
  'Agent canvas primitives from slice 03',
  { tag: '@agent' },
  () => {
    test('select-only preserves the semantic workflow graph', async ({
      comfyPage
    }) => {
      test.fixme(
        true,
        'Activates after slice PR 16186 merges: https://github.com/Comfy-Org/ComfyUI_frontend/pull/16186'
      )

      const node = await comfyPage.nodeOps.getFirstNodeRef()
      expect(node).not.toBeNull()
      if (!node) return

      const before = await comfyPage.nodeOps.getSerializedGraph()
      await node.click('title')

      await expect
        .poll(() => comfyPage.nodeOps.getSelectedGraphNodesCount())
        .toBe(1)
      await expect
        .poll(() => comfyPage.nodeOps.getSerializedGraph())
        .toEqual(before)
    })

    test('focuses a known node without changing its graph data', async ({
      comfyPage
    }) => {
      test.fixme(
        true,
        'Activates after slice PR 16186 merges: https://github.com/Comfy-Org/ComfyUI_frontend/pull/16186'
      )

      const node = await comfyPage.nodeOps.getFirstNodeRef()
      expect(node).not.toBeNull()
      if (!node) return

      const before = await comfyPage.nodeOps.getSerializedGraph()
      await node.centerOnNode()
      await expect
        .poll(() => comfyPage.nodeOps.getSerializedGraph())
        .toEqual(before)
    })

    test('fits the complete graph when a node is selected', async ({
      comfyPage
    }) => {
      test.fixme(
        true,
        'Activates after slice PR 16186 merges: https://github.com/Comfy-Org/ComfyUI_frontend/pull/16186'
      )

      const node = await comfyPage.nodeOps.getFirstNodeRef()
      expect(node).not.toBeNull()
      if (!node) return
      await node.click('title')

      await fitToViewInstant(comfyPage)
      const offset = await comfyPage.canvasOps.getOffset()
      expect(offset.every(Number.isFinite)).toBe(true)
    })

    test('moves one selected node and keeps its connection slots aligned', async ({
      comfyPage
    }) => {
      test.fixme(
        true,
        'Activates after slice PR 16186 merges: https://github.com/Comfy-Org/ComfyUI_frontend/pull/16186'
      )

      const node = await comfyPage.nodeOps.getFirstNodeRef()
      expect(node).not.toBeNull()
      if (!node) return

      const before = await comfyPage.canvasOps.getNodeGeometry(node.id)
      const position = await node.getPosition()
      await comfyPage.canvasOps.dragAndDrop(position, {
        x: position.x + 40,
        y: position.y + 20
      })
      const after = await comfyPage.canvasOps.getNodeGeometry(node.id)

      comfyPage.canvasOps.expectSlotsTrackedNode(after, before)
    })
  }
)
