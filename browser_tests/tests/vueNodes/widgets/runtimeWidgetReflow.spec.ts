import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'
import type { TestGraphAccess } from '@e2e/types/globals'

/**
 * Regression for #13863 (BUG-021). Extensions grow a node at runtime by writing
 * `node.size[1]` directly (an element mutation) and calling `setDirtyCanvas`,
 * bypassing the `set size` setter that mirrors height into the layout store, so
 * the Vue node kept its old height until a manual resize. The DevTools
 * `Node Runtime Reflow` node emulates both documented idioms:
 *  - widget-count growth (rgthree Power Lora Loader, Easy-Use, 0246, ...)
 *  - image-preview growth on `img.onload` with no widget change (Impact-Pack).
 */
test.describe('Runtime node reflow', { tag: '@vue-nodes' }, () => {
  const GROWTH = 40

  async function addReflowNode(comfyPage: ComfyPage) {
    const node = await comfyPage.nodeOps.addNode('DevToolsNodeRuntimeReflow')
    return String(node.id)
  }

  test('node grows when a widget is added at runtime', async ({
    comfyPage
  }) => {
    const nodeId = await addReflowNode(comfyPage)
    await fitToViewInstant(comfyPage)

    const node = comfyPage.vueNodes.getNodeLocator(nodeId)
    await expect(node).toBeVisible()
    const initialHeight = (await node.boundingBox())!.height

    await comfyPage.page.evaluate((id) => {
      const graph = window.graph as unknown as TestGraphAccess
      const target = graph._nodes_by_id[id] as unknown as {
        growByWidget: () => void
      }
      target.growByWidget()
    }, nodeId)

    await expect
      .poll(() => node.boundingBox().then((box) => box?.height ?? 0))
      .toBeGreaterThan(initialHeight + GROWTH)
  })

  test('node grows when an image preview loads at runtime', async ({
    comfyPage
  }) => {
    const nodeId = await addReflowNode(comfyPage)
    await fitToViewInstant(comfyPage)

    const node = comfyPage.vueNodes.getNodeLocator(nodeId)
    await expect(node).toBeVisible()
    const initialHeight = (await node.boundingBox())!.height

    // No widget is added here — growth is triggered purely by `img.onload`
    // setting `node.imgs` and `node.size[1]`.
    await comfyPage.page.evaluate((id) => {
      const graph = window.graph as unknown as TestGraphAccess
      const target = graph._nodes_by_id[id] as unknown as {
        growByPreview: () => void
      }
      target.growByPreview()
    }, nodeId)

    await expect
      .poll(() => node.boundingBox().then((box) => box?.height ?? 0))
      .toBeGreaterThan(initialHeight + GROWTH)
  })
})
