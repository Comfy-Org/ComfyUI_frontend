import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'

// PoC test for the "attach video walkthrough of new tests to the PR" CI
// change. It only needs to exist as a *newly-added* spec file so CI's
// new-test detection has something to record a video of, but it performs a
// real, visually legible sequence of canvas actions so the recording is
// worth watching.
test.describe('CI video PoC smoke', { tag: ['@smoke', '@node'] }, () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.canvasOps.resetView()
  })

  test('adds a Preview Image node and wires it to VAE Decode', async ({
    comfyPage
  }) => {
    const [vaeDecode] = await comfyPage.nodeOps.getNodeRefsByType('VAEDecode')
    const initialNodeCount = await comfyPage.nodeOps.getGraphNodesCount()

    await comfyPage.searchBoxV2.addNode('Preview Image')
    await expect
      .poll(() => comfyPage.nodeOps.getGraphNodesCount())
      .toBe(initialNodeCount + 1)

    const [previewImage] =
      await comfyPage.nodeOps.getNodeRefsByType('PreviewImage')

    // VAE Decode sits far enough right in the default workflow that its
    // output slot can fall outside the viewport — fit the whole graph into
    // view first so both slots are actually on-screen for the drag below.
    await fitToViewInstant(comfyPage)
    await vaeDecode.connectOutput(0, previewImage, 0)

    // Zoom in on the new connection so it's clearly visible in the recording.
    await comfyPage.canvasOps.zoom(-120, 4)

    const previewImageInput = await previewImage.getInput(0)
    await expect
      .poll(async () => (await previewImageInput.getLink())?.origin_id)
      .toBe(vaeDecode.id)
    const link = await previewImageInput.getLink()
    expect(link?.target_id).toBe(previewImage.id)
  })
})
