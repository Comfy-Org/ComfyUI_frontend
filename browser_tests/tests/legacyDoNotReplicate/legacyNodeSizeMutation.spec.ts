import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { BAD_DO_NOT_DO_THIS_LegacyApiHelper } from '@e2e/fixtures/helpers/BAD_DO_NOT_DO_THIS_LegacyApiHelper'
import {
  REFLOW_GROWTH_THRESHOLD,
  addReflowNodeAndMeasure
} from '@e2e/fixtures/utils/runtimeReflow'

test.describe('Runtime node reflow', { tag: '@vue-nodes' }, () => {
  test('node grows when a widget is added at runtime', async ({
    comfyPage
  }) => {
    const { nodeId, node, initialHeight } =
      await addReflowNodeAndMeasure(comfyPage)
    const legacyApi = new BAD_DO_NOT_DO_THIS_LegacyApiHelper(comfyPage.page)

    await legacyApi.growNodeByMutatingSizeAfterAddingWidget(nodeId)

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
    const legacyApi = new BAD_DO_NOT_DO_THIS_LegacyApiHelper(comfyPage.page)

    await legacyApi.growNodeByMutatingSizeAfterLoadingPreview(nodeId)

    await expect
      .poll(() => node.boundingBox().then((box) => box?.height ?? 0), {
        message:
          'img.onload mutating size[1] with no widget change reflows the Vue node'
      })
      .toBeGreaterThan(initialHeight + REFLOW_GROWTH_THRESHOLD)
  })
})
