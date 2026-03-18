import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../../../../fixtures/ComfyPage'
import { fitToViewInstant } from '../../../../helpers/fitToView'

test.describe('Vue Node Text Bleed-Through', { tag: '@screenshot' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.workflow.loadWorkflow('vueNodes/overlapping-with-text')
    await comfyPage.vueNodes.waitForNodes()
    await fitToViewInstant(comfyPage)
  })

  test('overlapping node should not show text from node beneath', async ({
    comfyPage
  }) => {
    await expect(comfyPage.canvas).toHaveScreenshot(
      'node-text-no-bleed-through.png'
    )
  })
})
