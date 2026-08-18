import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'Viewport culling lifecycle',
  { tag: ['@canvas', '@node', '@vue-nodes', '@slow'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await comfyPage.settings.setSetting(
        'Comfy.VueNodes.ViewportCulling',
        false
      )
      await comfyPage.workflow.loadWorkflow('large-graph-workflow')
      await comfyPage.page.evaluate(() => {
        const canvas = window.app!.canvas
        canvas.ds.changeScale(1, undefined, false)
        canvas.ds.offset[0] = 0
        canvas.ds.offset[1] = 0
        canvas.setDirty(true, true)
      })
      await comfyPage.nextFrame()
      await comfyPage.vueNodes.waitForNodes()
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting(
        'Comfy.VueNodes.ViewportCulling',
        false
      )
      await comfyPage.canvasOps.resetView()
    })

    test('turning destructive culling off detaches and preserves node instances', async ({
      comfyPage
    }) => {
      test.slow()
      const initialNode = comfyPage.vueNodes.nodes.first()
      await expect(initialNode).toBeVisible()
      const nodeId = await initialNode.getAttribute('data-node-id')
      const initialElement = await initialNode.elementHandle()
      if (!nodeId || !initialElement) {
        throw new Error('Expected a mounted Vue node with a node id')
      }

      await comfyPage.page.evaluate(() => {
        const canvas = window.app!.canvas
        canvas.ds.offset[0] = -100_000
        canvas.setDirty(true, true)
      })
      await comfyPage.nextFrame()

      await expect
        .poll(() => initialElement.evaluate((element) => element.isConnected))
        .toBe(false)
      await expect
        .poll(() => comfyPage.vueNodes.getNodeCount())
        .toBeLessThan(245)

      await comfyPage.page.evaluate(() => {
        const canvas = window.app!.canvas
        canvas.ds.offset[0] = 0
        canvas.setDirty(true, true)
      })
      await comfyPage.nextFrame()

      const returnedNode = comfyPage.vueNodes.getNodeLocator(nodeId)
      await expect(returnedNode).toBeVisible()
      const returnedElement = await returnedNode.elementHandle()
      if (!returnedElement) throw new Error('Expected the Vue node to return')

      expect(
        await initialElement.evaluate(
          (element, candidate) => element === candidate,
          returnedElement
        )
      ).toBe(true)
    })
  }
)
