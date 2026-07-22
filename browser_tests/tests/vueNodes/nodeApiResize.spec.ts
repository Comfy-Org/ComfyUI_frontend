import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

import type { ComfyExtensionApi } from '@/extension-api'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

/**
 * Exercises the first slice of the v2 stable node API: an extension registers
 * with `defineNodeExtension` and, in `nodeCreated`, resizes the delivered
 * `NodeHandle` via `node.setSize([w, h])`. The handle routes the mutation
 * through the layout store (the single source of truth), so the Vue node reflows
 * to the new height. Proves the sanctioned replacement for `node.size[1] = h`
 * drives the real layout path — with the handle delivered by the extension
 * lifecycle, not fetched by id from a global.
 */
test.describe(
  'Node API — defineNodeExtension setSize',
  { tag: ['@vue-nodes', '@node'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      // Minimap overlays the canvas and can intercept pointer events; keep the
      // canvas clean and at a known transform so screen-space size deltas hold.
      await comfyPage.settings.setSetting('Comfy.Minimap.Visible', false)
      await comfyPage.canvasOps.resetView()
    })

    test('setSize grows the Vue node through the nodeCreated handle', async ({
      comfyPage
    }) => {
      const node = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
      const initial = await node.boundingBox()
      if (!initial) throw new Error('KSampler node bounding box not found')

      await comfyPage.page.evaluate(() => {
        const api = (
          window as typeof window & { comfyExtensionApi?: ComfyExtensionApi }
        ).comfyExtensionApi
        if (!api) throw new Error('window.comfyExtensionApi is not installed')
        api.defineNodeExtension({
          name: 'e2e.node-api-resize',
          nodeTypes: ['KSampler'],
          nodeCreated(handle) {
            // Grow well above any default content-minimum so the delta is
            // unambiguous at any canvas scale.
            handle.setSize([400, 1000])
          }
        })
      })

      // Re-create the graph's nodes so `nodeCreated` fires for the existing
      // KSampler now that the extension is registered.
      const workflow = await comfyPage.page.evaluate(
        () => window.app!.graph.serialize() as ComfyWorkflowJSON
      )
      await comfyPage.workflow.loadGraphData(workflow)
      await comfyPage.canvasOps.resetView()

      const resized = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
      await expect.poll(resized.pollHeight).toBeGreaterThan(initial.height)
    })
  }
)
