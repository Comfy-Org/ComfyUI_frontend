import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

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
    await vaeDecode.connectOutput(0, previewImage, 0)

    // Zoom in on the new connection so it's clearly visible in the recording.
    await comfyPage.canvasOps.zoom(-120, 4)

    const link = await (await previewImage.getInput(0)).getLink()
    expect(link?.origin_id).toBe(vaeDecode.id)
    expect(link?.target_id).toBe(previewImage.id)
  })
})
