import { readFileSync } from 'fs'
import { resolve } from 'path'

import { expect } from '@playwright/test'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

interface SlotMeasurement {
  key: string
  offsetX: number
  offsetY: number
}

interface NodeSlotData {
  nodeId: string
  isSubgraph: boolean
  nodeW: number
  nodeH: number
  slots: SlotMeasurement[]
}

/**
 * Regression test for link misalignment on SubgraphNodes when loading
 * workflows with workflowRendererVersion: "LG".
 *
 * Root cause: ensureCorrectLayoutScale scales nodes by 1.2x for LG workflows,
 * and fitView() updates lgCanvas.ds immediately. The Vue TransformPane's CSS
 * transform lags by a frame, causing clientPosToCanvasPos to produce wrong
 * slot offsets. The fix uses DOM-relative measurement instead.
 */
test.describe(
  'Subgraph slot alignment after LG layout scale',
  { tag: ['@subgraph', '@canvas'] },
  () => {
    test('slot positions stay within node bounds after loading LG workflow', async ({
      comfyPage
    }) => {
      const SLOT_BOUNDS_MARGIN = 20
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)

      const workflowPath = resolve(
        import.meta.dirname,
        '../assets/subgraphs/basic-subgraph.json'
      )
      const workflow = JSON.parse(
        readFileSync(workflowPath, 'utf-8')
      ) as ComfyWorkflowJSON
      workflow.extra = {
        ...workflow.extra,
        workflowRendererVersion: 'LG'
      }

      await comfyPage.page.evaluate(
        (wf) =>
          window.app!.loadGraphData(wf as ComfyWorkflowJSON, true, true, null, {
            openSource: 'template'
          }),
        workflow
      )
      await comfyPage.nextFrame()

      // Wait for slot elements to appear in DOM
      await comfyPage.page.locator('[data-slot-key]').first().waitFor()

      const result: NodeSlotData[] = await comfyPage.page.evaluate(() => {
        const nodes = window.app!.graph._nodes
        const slotData: NodeSlotData[] = []

        for (const node of nodes) {
          const nodeId = String(node.id)
          const nodeEl = document.querySelector(
            `[data-node-id="${nodeId}"]`
          ) as HTMLElement | null
          if (!nodeEl) continue

          const slotEls = nodeEl.querySelectorAll('[data-slot-key]')
          if (slotEls.length === 0) continue

          const slots: SlotMeasurement[] = []

          const nodeRect = nodeEl.getBoundingClientRect()
          for (const slotEl of slotEls) {
            const slotRect = slotEl.getBoundingClientRect()
            const slotKey = (slotEl as HTMLElement).dataset.slotKey ?? 'unknown'
            slots.push({
              key: slotKey,
              offsetX: slotRect.left + slotRect.width / 2 - nodeRect.left,
              offsetY: slotRect.top + slotRect.height / 2 - nodeRect.top
            })
          }

          slotData.push({
            nodeId,
            isSubgraph: !!node.isSubgraphNode?.(),
            nodeW: nodeRect.width,
            nodeH: nodeRect.height,
            slots
          })
        }

        return slotData
      })

      const subgraphNodes = result.filter((n) => n.isSubgraph)
      expect(subgraphNodes.length).toBeGreaterThan(0)

      for (const node of subgraphNodes) {
        for (const slot of node.slots) {
          expect(
            slot.offsetX,
            `Slot ${slot.key} on node ${node.nodeId}: X offset ${slot.offsetX} outside node width ${node.nodeW}`
          ).toBeGreaterThanOrEqual(-SLOT_BOUNDS_MARGIN)
          expect(
            slot.offsetX,
            `Slot ${slot.key} on node ${node.nodeId}: X offset ${slot.offsetX} outside node width ${node.nodeW}`
          ).toBeLessThanOrEqual(node.nodeW + SLOT_BOUNDS_MARGIN)

          expect(
            slot.offsetY,
            `Slot ${slot.key} on node ${node.nodeId}: Y offset ${slot.offsetY} outside node height ${node.nodeH}`
          ).toBeGreaterThanOrEqual(-SLOT_BOUNDS_MARGIN)
          expect(
            slot.offsetY,
            `Slot ${slot.key} on node ${node.nodeId}: Y offset ${slot.offsetY} outside node height ${node.nodeH}`
          ).toBeLessThanOrEqual(node.nodeH + SLOT_BOUNDS_MARGIN)
        }
      }
    })
  }
)
