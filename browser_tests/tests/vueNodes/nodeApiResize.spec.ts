import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

/**
 * Exercises the first slice of the stable node API: an extension resizes a node
 * by id through `window.comfyNodeApi.getNode(id).setSize(w, h)`, which dispatches
 * the `Comfy.Node.Resize` command → `layoutStore`. Asserts the Vue node reflows
 * to the new height, proving the API drives the real layout path (not just the
 * canvas). Sanctioned replacement for the legacy `node.size[1] = h` mutation.
 */
test.describe(
  'Node API — setSize resize',
  { tag: ['@vue-nodes', '@node'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      // Minimap overlays the canvas and can intercept pointer events; keep the
      // canvas clean and at a known transform so screen-space size deltas hold.
      await comfyPage.settings.setSetting('Comfy.Minimap.Visible', false)
      await comfyPage.canvasOps.resetView()
    })

    test('setSize grows the Vue node through layoutStore', async ({
      comfyPage
    }) => {
      const nodeId = await comfyPage.vueNodes.getNodeIdByTitle('KSampler')
      const node = await comfyPage.vueNodes.getFixtureByTitle('KSampler')

      const initial = await node.boundingBox()
      if (!initial) throw new Error('KSampler node bounding box not found')

      await comfyPage.page.evaluate(async (id) => {
        const nodeApi = (
          window as typeof window & {
            comfyNodeApi?: {
              getNode(nodeId: string): {
                setSize(width: number, height: number): Promise<void>
              }
            }
          }
        ).comfyNodeApi
        if (!nodeApi) throw new Error('window.comfyNodeApi is not installed')
        // Target a height well above any default node's content-minimum so the
        // grow is unambiguous at any canvas scale.
        await nodeApi.getNode(id).setSize(400, 1000)
      }, nodeId)

      await expect.poll(node.pollHeight).toBeGreaterThan(initial.height)
    })
  }
)
