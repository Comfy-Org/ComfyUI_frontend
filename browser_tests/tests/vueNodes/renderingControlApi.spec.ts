import type { VueNodeRenderingPushController } from '@/types/vueNodeRendering'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

declare global {
  interface Window {
    vueNodeRenderingTestControllers?: readonly VueNodeRenderingPushController[]
  }
}

test.describe(
  'Vue node rendering control API',
  { tag: ['@vue-nodes', '@canvas'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('default')
      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const snapshot =
              window.app!.extensionManager.vueNodes.rendering.getSnapshot()
            return (
              snapshot.nodeIds.length > 0 &&
              snapshot.initializedNodeIds.length === snapshot.nodeIds.length
            )
          })
        )
        .toBe(true)
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.page.evaluate(() => {
        for (const controller of window.vueNodeRenderingTestControllers ?? []) {
          controller.dispose()
        }
        delete window.vueNodeRenderingTestControllers
      })
    })

    test('composes owners without changing graph or link geometry', async ({
      comfyPage
    }) => {
      const baselineGraph = await comfyPage.nodeOps.getSerializedGraph()
      const graphNodeCount = baselineGraph.nodes.length
      const linkedNodes = await comfyPage.page.evaluate(() => {
        const graph = window.app!.graph
        const link = graph.links.values().next().value
        if (!link) throw new Error('Default workflow has no links')
        return {
          originId: String(link.origin_id),
          targetId: String(link.target_id),
          targetSlot: link.target_slot
        }
      })
      const targetSlot = comfyPage.vueNodes.getInputSlotConnectionDot(
        linkedNodes.targetId,
        linkedNodes.targetSlot
      )
      const initialSlotBox = await targetSlot.boundingBox()
      if (!initialSlotBox) throw new Error('Target slot geometry unavailable')

      await comfyPage.page.evaluate(({ originId, targetId }) => {
        const rendering = window.app!.extensionManager.vueNodes.rendering
        const suppressTarget = rendering.createPushController(
          'browser-test:suppress-target'
        )
        const retainTarget = rendering.createPushController(
          'browser-test:retain-target'
        )
        window.vueNodeRenderingTestControllers = [suppressTarget, retainTarget]
        suppressTarget.update({ suppress: [targetId] })
        retainTarget.update({ suppress: [originId], retain: [targetId] })
      }, linkedNodes)

      await expect(
        comfyPage.vueNodes.getNodeLocator(linkedNodes.originId)
      ).toHaveCount(0)
      await expect(
        comfyPage.vueNodes.getNodeLocator(linkedNodes.targetId)
      ).toBeVisible()

      await comfyPage.page.evaluate(({ originId }) => {
        window.vueNodeRenderingTestControllers?.[1].update({
          suppress: [originId]
        })
      }, linkedNodes)
      await expect(
        comfyPage.vueNodes.getNodeLocator(linkedNodes.targetId)
      ).toHaveCount(0)

      await comfyPage.page.evaluate(() => {
        window.vueNodeRenderingTestControllers?.[0].clear()
      })
      await expect(
        comfyPage.vueNodes.getNodeLocator(linkedNodes.targetId)
      ).toBeVisible()
      await expect
        .poll(() => targetSlot.boundingBox())
        .toMatchObject({
          x: expect.closeTo(initialSlotBox.x, 0),
          y: expect.closeTo(initialSlotBox.y, 0)
        })

      await comfyPage.page.evaluate(() => {
        window.vueNodeRenderingTestControllers?.[1].clear()
      })
      await expect(
        comfyPage.vueNodes.getNodeLocator(linkedNodes.originId)
      ).toBeVisible()
      expect(await comfyPage.nodeOps.getSerializedGraph()).toEqual(
        baselineGraph
      )
      expect(
        await comfyPage.page.evaluate(() => window.app!.graph.nodes.length)
      ).toBe(graphNodeCount)
    })
  }
)
