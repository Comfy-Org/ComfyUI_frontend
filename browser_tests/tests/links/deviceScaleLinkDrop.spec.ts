import { expect } from '@playwright/test'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Link drop under device scaling', { tag: '@canvas' }, () => {
  test('@2x @0.5x A dragged link lands on the slot it was aimed at', async ({
    comfyPage
  }) => {
    await comfyPage.nodeOps.clearGraph()

    const source = await comfyPage.nodeOps.addNode('EmptyImage', undefined, {
      x: 120,
      y: 240
    })
    const target = await comfyPage.nodeOps.addNode(
      'ImageCompositeMasked',
      undefined,
      { x: 620, y: 240 }
    )
    await comfyPage.nextFrame()

    const imageInputs = await comfyPage.page.evaluate((id) => {
      const node = window.app!.canvas.graph!.getNodeById(id)!
      return node.inputs
        .map((input, index) => ({ index, name: input.name, type: input.type }))
        .filter((input) => input.type === 'IMAGE')
    }, target.id)

    expect(
      imageInputs.length,
      'ImageCompositeMasked should expose several IMAGE inputs'
    ).toBeGreaterThan(1)

    const destination = imageInputs.find(
      (input) => input.name === 'destination'
    )
    if (!destination) {
      throw new Error('ImageCompositeMasked should expose a destination input')
    }

    const destinationInput = await target.getInput(destination.index)
    expect(
      await destinationInput.getLink(),
      'destination should start unconnected'
    ).toBeNull()

    await source.connectOutput(0, target, destination.index)

    await expect
      .poll(() => destinationInput.getLink())
      .toMatchObject({
        origin_id: source.id
      })
  })
})
