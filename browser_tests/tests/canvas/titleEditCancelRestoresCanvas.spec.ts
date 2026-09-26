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
 * The gesture under test is the wheel, because `LGraphCanvas.processMouseWheel`
 * returns on `!allow_dragcanvas` before it touches `ds` - one branch, with no
 * pointer click-versus-drag classification in the way. The effect is read off
 * `ds.scale` rather than off the flag, so the spec keeps its meaning if the fix
 * is later expressed some other way.
 */
test.describe('Cancelling a title edit', { tag: ['@canvas', '@node'] }, () => {
  test('leaves the canvas zoomable', async ({ comfyPage }) => {
    const WHEEL_POS = { x: 400, y: 400 }
    const wheelZoom = async () => {
      await comfyPage.page.mouse.move(WHEEL_POS.x, WHEEL_POS.y)
      await comfyPage.page.mouse.wheel(0, -120)
      await comfyPage.nextFrame()
      return comfyPage.canvasOps.getScale()
    }

    // Establish that the gesture moves this canvas at all, before the title
    // edit. Without it, a wheel that does nothing for an unrelated reason
    // reads exactly like the regression.
    const scaleAtStart = await comfyPage.canvasOps.getScale()
    expect(await wheelZoom()).not.toBeCloseTo(scaleAtStart, 3)

    const [node] = await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
    const originalTitle = await node.getProperty<string>('title')

    await comfyPage.canvasOps.mouseDblclickAt(await node.getTitlePosition())
    await comfyPage.titleEditor.expectVisible()

    await comfyPage.titleEditor.cancel()
    await comfyPage.titleEditor.expectHidden()

    // Escape discards the edit. The zoom assertion below would pass just as
    // well on a build that committed it, so pin the discard too.
    expect(await node.getProperty<string>('title')).toBe(originalTitle)

    const scaleBeforeZoom = await comfyPage.canvasOps.getScale()
    expect(await wheelZoom()).not.toBeCloseTo(scaleBeforeZoom, 3)
  })
})
