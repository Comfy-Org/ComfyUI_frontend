import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { Load3DHelper } from '@e2e/tests/load3d/Load3DHelper'
import { Load3DViewerHelper } from '@e2e/tests/load3d/Load3DViewerHelper'

export const load3dTest = comfyPageFixture.extend<{
  load3d: Load3DHelper
}>({
  load3d: async ({ comfyPage }, use) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.workflow.loadWorkflow('3d/load3d_node')
    await comfyPage.vueNodes.waitForNodes()

    const node = comfyPage.vueNodes.getNodeLocator('1')
    await use(new Load3DHelper(node))
  }
})

export const load3dViewerTest = load3dTest.extend<{
  viewer: Load3DViewerHelper
}>({
  viewer: async ({ comfyPage }, use) => {
    await comfyPage.settings.setSetting('Comfy.Load3D.3DViewerEnable', true)
    await use(new Load3DViewerHelper(comfyPage.page))
  }
})

export const load3dVueEnabledTest = comfyPageFixture.extend<{
  enableVueNodes: void
}>({
  enableVueNodes: [
    async ({ comfyPage }, use) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await use()
    },
    { auto: true }
  ]
})
