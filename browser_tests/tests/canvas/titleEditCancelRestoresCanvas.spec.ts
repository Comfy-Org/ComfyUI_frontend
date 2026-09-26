import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

/**
 * Regression coverage for https://github.com/Comfy-Org/ComfyUI_frontend/issues/18513.
 *
 * `TitleEditor` disables `allow_dragcanvas` while an edit is open. Before the
 * fix it restored the flag only on commit, and `EditableText` emits `cancel`
 * rather than `edit` on Escape - so cancelling an edit left the canvas unable
 * to pan or wheel-zoom for the rest of the session.
 *
 * Both gestures are asserted because `allow_dragcanvas` gates both:
 * `LGraphCanvas.processMouseWheel` returns early on it, and the pointer paths
 * only reach `setupCanvasDrag` when it is true. Panning and zooming are
 * observed through `ds.offset` / `ds.scale` rather than through the flag, so
 * the test still means something if the fix stops being expressed that way.
 */
test.describe('Cancelling a title edit', { tag: ['@canvas', '@node'] }, () => {
  test('leaves the canvas pannable and zoomable', async ({ comfyPage }) => {
    const [node] = await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
    const originalTitle = await node.getProperty<string>('title')

    await comfyPage.canvasOps.mouseDblclickAt(await node.getTitlePosition())
    await comfyPage.titleEditor.expectVisible()

    await comfyPage.titleEditor.cancel()
    await comfyPage.titleEditor.expectHidden()

    // Escape discards the edit. The canvas assertions below would pass just as
    // well on a build that committed it, so pin the discard too.
    expect(await node.getProperty<string>('title')).toBe(originalTitle)

    const offsetBeforePan = await comfyPage.canvasOps.getOffset()
    await comfyPage.canvasOps.pan({ x: 120, y: 80 })
    await expect
      .poll(() => comfyPage.canvasOps.getOffset())
      .not.toEqual(offsetBeforePan)

    const scaleBeforeZoom = await comfyPage.canvasOps.getScale()
    await comfyPage.canvasOps.zoom(-120)
    await expect
      .poll(() => comfyPage.canvasOps.getScale())
      .not.toBe(scaleBeforeZoom)
  })
})
