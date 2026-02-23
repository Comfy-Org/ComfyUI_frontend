import { expect } from '@playwright/test'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

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
      // Load the basic-subgraph workflow, injecting workflowRendererVersion: "LG"
      // to trigger the 1.2x scale in ensureCorrectLayoutScale.
      const result = await comfyPage.page.evaluate(async () => {
        const app = window.app!
        const resp = await fetch('/browser_tests/assets/subgraphs/basic-subgraph.json')
        const workflow = (await resp.json()) as ComfyWorkflowJSON

        // Force LG renderer version to trigger ensureCorrectLayoutScale 1.2x
        workflow.extra = {
          ...workflow.extra,
          workflowRendererVersion: 'LG'
        }

        await app.loadGraphData(workflow, true, true, null, {
          openSource: 'template'
        })

        // Wait for slot layout sync (RAF + nextTick)
        await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50)))

        // Collect node positions/sizes and their slot positions
        const nodes = app.graph._nodes
        const slotData: Array<{
          nodeId: string
          nodeX: number
          nodeY: number
          nodeW: number
          nodeH: number
          slots: Array<{
            key: string
            offsetX: number
            offsetY: number
          }>
        }> = []

        for (const node of nodes) {
          const nodeId = String(node.id)
          const nodeEl = document.querySelector(
            `[data-node-id="${nodeId}"]`
          ) as HTMLElement | null
          if (!nodeEl) continue

          const slotEls = nodeEl.querySelectorAll('[data-slot-key]')
          if (slotEls.length === 0) continue

          const slots: Array<{
            key: string
            offsetX: number
            offsetY: number
          }> = []

          const nodeRect = nodeEl.getBoundingClientRect()
          for (const slotEl of slotEls) {
            const slotRect = slotEl.getBoundingClientRect()
            const slotKey =
              (slotEl as HTMLElement).dataset.slotKey ?? 'unknown'
            slots.push({
              key: slotKey,
              offsetX:
                slotRect.left +
                slotRect.width / 2 -
                nodeRect.left,
              offsetY:
                slotRect.top +
                slotRect.height / 2 -
                nodeRect.top
            })
          }

          slotData.push({
            nodeId,
            nodeX: node.pos[0],
            nodeY: node.pos[1],
            nodeW: nodeRect.width,
            nodeH: nodeRect.height,
            slots
          })
        }

        return slotData
      })

      // Verify we found at least one node with slots (the SubgraphNode)
      expect(result.length).toBeGreaterThan(0)

      for (const node of result) {
        for (const slot of node.slots) {
          // Slot center should be within reasonable bounds of the node element.
          // Allow small overflow for slot connectors that sit on the edge.
          const margin = 20
          expect(
            slot.offsetX,
            `Slot ${slot.key} on node ${node.nodeId}: X offset ${slot.offsetX} outside node width ${node.nodeW}`
          ).toBeGreaterThanOrEqual(-margin)
          expect(
            slot.offsetX,
            `Slot ${slot.key} on node ${node.nodeId}: X offset ${slot.offsetX} outside node width ${node.nodeW}`
          ).toBeLessThanOrEqual(node.nodeW + margin)

          expect(
            slot.offsetY,
            `Slot ${slot.key} on node ${node.nodeId}: Y offset ${slot.offsetY} outside node height ${node.nodeH}`
          ).toBeGreaterThanOrEqual(-margin)
          expect(
            slot.offsetY,
            `Slot ${slot.key} on node ${node.nodeId}: Y offset ${slot.offsetY} outside node height ${node.nodeH}`
          ).toBeLessThanOrEqual(node.nodeH + margin)
        }
      }
    })
  }
)
