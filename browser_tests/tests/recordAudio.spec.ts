import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.setSetting('Comfy.UseNewMenu', 'Disabled')
})

test.describe('Record Audio Node', () => {
  test('should add a record audio node and take a screenshot', async ({
    comfyPage
  }) => {
    // Open the search box by double clicking on the canvas
    await comfyPage.doubleClickCanvas()
    await expect(comfyPage.searchBox.input).toHaveCount(1)

    // Search for and add the RecordAudio node
    await comfyPage.searchBox.fillAndSelectFirstNode('RecordAudio')
    await comfyPage.nextFrame()

    // Verify the RecordAudio node was added
    const recordAudioNodes = await comfyPage.getNodeRefsByType('RecordAudio')
    expect(recordAudioNodes.length).toBe(1)

    // Take a screenshot of the canvas with the RecordAudio node
    await expect(comfyPage.canvas).toHaveScreenshot('record_audio_node.png')
  })
})
