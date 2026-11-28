import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import {
  routeObjectInfoFromSetupApi,
  setComboInputOptions
} from '@e2e/fixtures/utils/objectInfo'

const test = comfyPageFixture.extend({
  page: async ({ page }, use) => {
    const unrouteObjectInfo = await routeObjectInfoFromSetupApi(
      page,
      (objectInfo) =>
        setComboInputOptions(
          objectInfo,
          'CheckpointLoaderSimple',
          'ckpt_name',
          ['another_checkpoint.safetensors']
        )
    )

    try {
      await use(page)
    } finally {
      await unrouteObjectInfo()
    }
  }
})

test.describe('Default workflow model values', { tag: ['@widget'] }, () => {
  test('the default workflow keeps its checkpoint when the server lists only a different one', async ({
    comfyPage
  }) => {
    const checkpointLoader = await comfyPage.nodeOps.getNodeRefByType(
      'CheckpointLoaderSimple'
    )
    const checkpointWidget = await checkpointLoader.getWidgetByName('ckpt_name')

    await expect
      .poll(() => checkpointWidget.getValue())
      .toBe('v1-5-pruned-emaonly-fp16.safetensors')
  })
})
