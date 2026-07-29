import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  REFLOW_GROWTH_THRESHOLD,
  addReflowNodeAndMeasure,
  growNodeByPreview,
  growNodeByWidget
} from '@e2e/fixtures/utils/runtimeReflow'

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
  test('node grows when a widget is added at runtime', async ({
    comfyPage
  }) => {
    const { nodeId, node, initialHeight } =
      await addReflowNodeAndMeasure(comfyPage)

    await growNodeByWidget(comfyPage, nodeId)

    await expect
      .poll(() => node.boundingBox().then((box) => box?.height ?? 0), {
        message: 'adding a widget then mutating size[1] reflows the Vue node'
      })
      .toBeGreaterThan(initialHeight + REFLOW_GROWTH_THRESHOLD)
  })

  test('node grows when an image preview loads at runtime', async ({
    comfyPage
  }) => {
    const { nodeId, node, initialHeight } =
      await addReflowNodeAndMeasure(comfyPage)

    await growNodeByPreview(comfyPage, nodeId)

    await expect
      .poll(() => node.boundingBox().then((box) => box?.height ?? 0), {
        message:
          'img.onload mutating size[1] with no widget change reflows the Vue node'
      })
      .toBeGreaterThan(initialHeight + REFLOW_GROWTH_THRESHOLD)
  })
})
