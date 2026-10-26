import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { expectRegionScreenshot } from '@e2e/fixtures/utils/screenshotRegion'

test.use({
  initialSettings: {
    'Comfy.UseNewMenu': 'Disabled',
    'Comfy.NodeSearchBoxImpl': 'v1 (legacy)'
  }
})

test.describe('Record Audio Node', { tag: '@screenshot' }, () => {
  test('should add a record audio node and take a screenshot', async ({
    comfyPage
  }) => {
    await comfyPage.canvasOps.doubleClick()
    await expect(comfyPage.searchBox.input).toHaveCount(1)

    await comfyPage.searchBox.fillAndSelectFirstNode('Record Audio', {
      exact: true
    })
    await comfyPage.nextFrame()

    await expect
      .poll(
        async () =>
          (await comfyPage.nodeOps.getNodeRefsByType('RecordAudio')).length
      )
      .toBe(1)

    const [recordAudioNode] =
      await comfyPage.nodeOps.getNodeRefsByType('RecordAudio')
    await expectRegionScreenshot(
      comfyPage.page,
      [recordAudioNode],
      'record_audio_node.png'
    )
  })
})
