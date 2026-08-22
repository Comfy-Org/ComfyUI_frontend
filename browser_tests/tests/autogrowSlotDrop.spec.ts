import { expect, mergeTests } from '@playwright/test'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(comfyPageFixture, webSocketFixture)

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

  test('sequential connections each land on their own autogrow slot', async ({
    comfyPage
  }) => {
    // Three full drag gestures; the new-test CI job replays every action with
    // SLOW_MO=1000, which overruns the default 15s budget.
    test.setTimeout(60_000)

    const target = await comfyPage.nodeOps.addNode(
      'BatchImagesNode',
      undefined,
      { x: 700, y: 150 }
    )
    const sources = []
    for (let i = 0; i < 3; i++) {
      sources.push(
        await comfyPage.nodeOps.addNode('EmptyImage', undefined, {
          x: 100,
          y: 100 + i * 220
        })
      )
    }
    await comfyPage.nextFrame()

    for (const source of sources) {
      const freeIndex = await comfyPage.page.evaluate((id) => {
        const node = window.app!.canvas.graph!.getNodeById(id)!
        return node.inputs.findIndex((input) => input.link == null)
      }, target.id)
      expect(freeIndex).toBeGreaterThanOrEqual(0)

      const sourceOut = await source.getOutput(0)
      const targetIn = await target.getInput(freeIndex)
      await comfyPage.canvasOps.dragAndDrop(
        await sourceOut.getPosition(),
        await targetIn.getPosition()
      )
      await comfyPage.nextFrame()
    }

    // Exact topology: every source feeds its own slot, in order, and the group
    // still exposes a trailing empty slot to grow into.
    const topology = await comfyPage.page.evaluate((id) => {
      const node = window.app!.canvas.graph!.getNodeById(id)!
      return node.inputs.map((input) => ({
        name: input.name,
        originId:
          input.link == null
            ? null
            : (window.app!.canvas.graph!.getLink(input.link)?.origin_id ?? null)
      }))
    }, target.id)

    expect(topology.map((slot) => slot.originId)).toEqual([
      sources[0].id,
      sources[1].id,
      sources[2].id,
      null
    ])
  })
})
