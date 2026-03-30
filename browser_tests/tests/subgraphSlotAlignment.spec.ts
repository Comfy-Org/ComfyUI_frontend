import { readFileSync } from 'fs'
import { resolve } from 'path'

import { expect } from '@playwright/test'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import {
  expectSlotsWithinBounds,
  measureNodeSlotOffsets
} from '../fixtures/utils/slotBoundsUtil'

const SLOT_BOUNDS_MARGIN = 20

test.describe(
  'Subgraph slot alignment after LG layout scale',
  { tag: ['@subgraph', '@canvas'] },
  () => {
    test('slot positions stay within node bounds after loading LG workflow', async ({
      comfyPage
    }) => {
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

      await comfyPage.page.locator('[data-slot-key]').first().waitFor()

      const nodeIds = await comfyPage.page.evaluate(() =>
        window
          .app!.graph._nodes.filter((n) => !!n.isSubgraphNode?.())
          .map((n) => String(n.id))
      )
      expect(nodeIds.length).toBeGreaterThan(0)

      for (const nodeId of nodeIds) {
        const data = await measureNodeSlotOffsets(comfyPage.page, nodeId)
        expect(data, `Node ${nodeId} not found in DOM`).not.toBeNull()
        expectSlotsWithinBounds(data!, SLOT_BOUNDS_MARGIN, `Node ${nodeId}`)
      }
    })
  }
)
