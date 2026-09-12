import { expect } from '@playwright/test'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

/**
 * ECS 1.53 Area 10 asks that, under non-default display scaling, a link dragged
 * between two nodes attaches to the slot it was aimed at. Client coordinates do
 * not change with `deviceScaleFactor`, but the canvas does — LiteGraph converts
 * client points to graph space using the canvas backing size, so a wrong
 * conversion lands the wire on a neighbouring slot rather than failing outright.
 *
 * The title carries `@2x @0.5x`, so this runs in `chromium-2x`
 * (deviceScaleFactor 2) and `chromium-0.5x` (0.5). The base `chromium` project
 * does not grep those out, so it also runs at scale 1 — which is the control:
 * the same assertions must hold at every scale, and a failure only under
 * scaling is the defect this row is about.
 */
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

    // Precondition: there is more than one IMAGE slot to get wrong. With a
    // single candidate, "landed on the right slot" is not a claim about
    // coordinate conversion at all — any drop that connects would satisfy it.
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

    const linkedNames = () =>
      comfyPage.page.evaluate((id) => {
        const graph = window.app!.canvas.graph!
        const node = graph.getNodeById(id)!
        return node.inputs
          .filter((input) => input.link != null)
          .map((input) => input.name)
          .sort()
      }, target.id)

    expect(await linkedNames(), 'node should start unconnected').toEqual([])

    await source.connectOutput(0, target, destination.index)

    // Exactly the aimed slot, by name. A count would pass for a wire that
    // landed on the neighbouring IMAGE input, which is the failure mode
    // scaling produces — the link exists, just in the wrong place.
    await expect.poll(linkedNames).toEqual(['destination'])

    const origin = await comfyPage.page.evaluate(
      ({ id, slot }) => {
        const graph = window.app!.canvas.graph!
        const node = graph.getNodeById(id)!
        const link = node.inputs[slot]?.link
        return link == null ? null : (graph.links.get(link)?.origin_id ?? null)
      },
      { id: target.id, slot: destination.index }
    )
    expect(String(origin)).toBe(String(source.id))
  })
})
