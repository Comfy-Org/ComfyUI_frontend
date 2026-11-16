import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { WidgetSelectDefaultFixture } from '@e2e/fixtures/components/WidgetSelectDefault'
import {
  routeObjectInfoFromSetupApi,
  setComboInputOptions
} from '@e2e/fixtures/utils/objectInfo'

export const folderComboTest = comfyPageFixture.extend<{
  modelCombo: WidgetSelectDefaultFixture
}>({
  page: async ({ page }, use) => {
    await routeObjectInfoFromSetupApi(page, (objectInfo) =>
      setComboInputOptions(objectInfo, 'CheckpointLoaderSimple', 'ckpt_name', [
        'v1-5-pruned-emaonly-fp16.safetensors',
        'studio/models/portrait.safetensors',
        'studio/models/landscape.safetensors',
        'archive/portrait.safetensors'
      ])
    )
    await use(page)
  },
  modelCombo: async ({ comfyPage }, use) => {
    await comfyPage.workflow.loadWorkflow('default')
    await use(
      new WidgetSelectDefaultFixture(
        comfyPage.vueNodes.getNodeByTitle('Load Checkpoint'),
        'ckpt_name'
      )
    )
  }
})
