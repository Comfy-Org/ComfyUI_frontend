import { expect } from '@playwright/test'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

/**
 * `BatchImagesNode` is an autogrow ("multi-grow") node: connecting its last
 * image input appends a new empty one. Autogrow nodes in the wild stack several
 * differently typed groups, so a drop aimed at the image group easily lands on a
 * neighbouring slot of another type.
 */
test.describe('Autogrow slot drop', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.nodeOps.clearGraph()
  })

  test('drop on an incompatible slot falls back to a free compatible slot', async ({
    comfyPage
  }) => {
    const target = await comfyPage.nodeOps.addNode(
      'ImageCompositeMasked',
      undefined,
      { x: 600, y: 200 }
    )
    const source = await comfyPage.nodeOps.addNode('EmptyImage', undefined, {
      x: 100,
      y: 200
    })
    await comfyPage.nextFrame()

    const slots = await comfyPage.page.evaluate((id) => {
      const node = window.app!.canvas.graph!.getNodeById(id)!
      return node.inputs.map((input) => input.name)
    }, target.id)
    const maskIndex = slots.indexOf('mask')
    const destinationIndex = slots.indexOf('destination')
    expect(maskIndex).toBeGreaterThanOrEqual(0)
    expect(destinationIndex).toBeGreaterThanOrEqual(0)

    const sourceOut = await source.getOutput(0)
    const maskIn = await target.getInput(maskIndex)

    // MASK cannot take an IMAGE link, but `destination` is free and compatible.
    await comfyPage.canvasOps.dragAndDrop(
      await sourceOut.getPosition(),
      await maskIn.getPosition()
    )
    await comfyPage.nextFrame()

    expect(await maskIn.getLink()).toBeNull()
    const destinationLink = await (
      await target.getInput(destinationIndex)
    ).getLink()
    expect(destinationLink?.origin_id).toBe(source.id)
  })
})
