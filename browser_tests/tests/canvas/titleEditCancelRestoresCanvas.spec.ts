import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('Cancelling a title edit', { tag: ['@canvas', '@node'] }, () => {
  test('leaves the canvas zoomable', async ({ comfyPage }) => {
    const WHEEL_POS = { x: 400, y: 400 }
    const wheelZoom = async () => {
      await comfyPage.page.mouse.move(WHEEL_POS.x, WHEEL_POS.y)
      await comfyPage.page.mouse.wheel(0, -120)
      await comfyPage.nextFrame()
      return comfyPage.canvasOps.getScale()
    }

    const scaleAtStart = await comfyPage.canvasOps.getScale()
    expect(await wheelZoom()).not.toBeCloseTo(scaleAtStart, 3)

    const [node] = await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')

    await comfyPage.canvasOps.mouseDblclickAt(await node.getTitlePosition())
    await comfyPage.titleEditor.expectVisible()

    await comfyPage.titleEditor.cancel()
    await comfyPage.titleEditor.expectHidden()

    const scaleBeforeZoom = await comfyPage.canvasOps.getScale()
    expect(await wheelZoom()).not.toBeCloseTo(scaleBeforeZoom, 3)
  })
})
