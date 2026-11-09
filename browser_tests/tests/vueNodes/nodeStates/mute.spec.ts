import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { expectRegionScreenshot } from '@e2e/fixtures/utils/screenshotRegion'

const MUTE_HOTKEY = 'Control+m'
const MUTE_OPACITY = '0.5'

test.describe('Vue Node Mute', { tag: '@vue-nodes' }, () => {
  test(
    'should toggle mute only on selected nodes with hotkey',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      const [offsetX, offsetY] = await comfyPage.canvasOps.getOffset()
      await comfyPage.canvasOps.setOffset([offsetX + 150, offsetY])
      const checkpointNode =
        comfyPage.vueNodes.getNodeByTitle('Load Checkpoint')
      const ksamplerNode = comfyPage.vueNodes.getNodeByTitle('KSampler')
      const unselectedNode =
        comfyPage.vueNodes.getNodeByTitle('Empty Latent Image')
      await comfyPage.page.getByText('Load Checkpoint').click()
      await expect(checkpointNode).toHaveAttribute('data-emphasized', 'true')

      await comfyPage.page.keyboard.press(MUTE_HOTKEY)
      await expect(checkpointNode).toHaveCSS('opacity', MUTE_OPACITY)
      await expect(unselectedNode).toHaveCSS('opacity', '1')
      await expectRegionScreenshot(
        comfyPage.page,
        [checkpointNode],
        'vue-node-muted-state.png'
      )

      await comfyPage.page
        .getByText('KSampler')
        .click({ modifiers: ['Control'] })
      await expect(ksamplerNode).toHaveAttribute('data-emphasized', 'true')
      await comfyPage.page.keyboard.press(MUTE_HOTKEY)
      await expect(checkpointNode).toHaveCSS('opacity', MUTE_OPACITY)
      await expect(ksamplerNode).toHaveCSS('opacity', MUTE_OPACITY)
      await expect(unselectedNode).toHaveCSS('opacity', '1')

      await comfyPage.page.keyboard.press(MUTE_HOTKEY)
      await expect(checkpointNode).toHaveCSS('opacity', '1')
      await expect(ksamplerNode).toHaveCSS('opacity', '1')
      await expect(unselectedNode).toHaveCSS('opacity', '1')
    }
  )
})
