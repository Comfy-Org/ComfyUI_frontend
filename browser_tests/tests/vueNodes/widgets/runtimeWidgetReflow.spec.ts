import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { TestGraphAccess } from '@e2e/types/globals'

/**
 * Regression for #13863 (BUG-021): extensions such as rgthree's Power Lora
 * Loader grow a node at runtime via `node.addCustomWidget(...)` followed by a
 * direct `node.size[1] = ...` mutation and `setDirtyCanvas(...)`. The direct
 * size mutation bypasses the `set size` setter that mirrors height into the
 * layout store, so the Vue node kept its old height until a manual resize.
 */
test.describe('Runtime widget reflow', { tag: '@vue-nodes' }, () => {
  test('node grows when a widget is added at runtime', async ({
    comfyPage
  }) => {
    const node = comfyPage.vueNodes.getNodeLocator('4')
    await expect(node).toBeVisible()
    const initialHeight = (await node.boundingBox())!.height

    await comfyPage.page.evaluate(() => {
      const graph = window.graph as TestGraphAccess
      const target = graph._nodes_by_id['4']
      const grownHeight = target.size[1] + 80
      // Emulate the rgthree "Add Lora" growth path exactly.
      target.addCustomWidget({
        type: 'custom',
        name: 'runtime_lora',
        value: 0,
        y: 0
      } as never)
      target.size[1] = grownHeight
      target.setDirtyCanvas(true, true)
    })

    await expect
      .poll(() => node.boundingBox().then((box) => box?.height ?? 0))
      .toBeGreaterThan(initialHeight + 40)
  })
})
