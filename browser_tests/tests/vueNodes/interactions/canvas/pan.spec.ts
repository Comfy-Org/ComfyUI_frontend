import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('Vue Nodes Canvas Pan', { tag: '@vue-nodes' }, () => {
  test(
    '@mobile Can pan with touch',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      await comfyPage.canvasOps.panWithTouch(
        { x: 64, y: 64 },
        { x: 256, y: 256 }
      )
      await expect(comfyPage.canvas).toHaveScreenshot(
        'vue-nodes-paned-with-touch.png'
      )
    }
  )

  test('Middle-click drag on node should pan canvas', async ({ comfyPage }) => {
    const node = comfyPage.vueNodes
      .getNodeByTitle('CLIP Text Encode (Prompt)')
      .first()
    const nodeBounds = await node.boundingBox()
    if (!nodeBounds) throw new Error('Node bounding box not found')

    const start = {
      x: nodeBounds.x + nodeBounds.width / 2,
      y: nodeBounds.y + nodeBounds.height / 2
    }

    const offsetBefore = await comfyPage.page.evaluate(() => {
      const ds = window.app!.canvas!.ds
      return [ds.offset[0], ds.offset[1]]
    })

    await comfyPage.page.mouse.move(start.x, start.y)
    await comfyPage.page.mouse.down({ button: 'middle' })
    await comfyPage.page.mouse.move(start.x + 140, start.y + 90, { steps: 10 })
    await comfyPage.page.mouse.up({ button: 'middle' })
    await comfyPage.nextFrame()

    await expect
      .poll(
        () =>
          comfyPage.page.evaluate(() => {
            const ds = window.app!.canvas!.ds
            return [ds.offset[0], ds.offset[1]]
          }),
        { message: 'Expected middle drag on node to pan canvas offset' }
      )
      .not.toEqual(offsetBefore)
  })
})
