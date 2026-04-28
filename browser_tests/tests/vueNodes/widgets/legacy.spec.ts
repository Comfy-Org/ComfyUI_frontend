import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test('@vue-nodes In App Mode, widget width updates with panel size', async ({
  comfyPage,
  comfyMouse
}) => {
  await test.step('setup', async () => {
    await comfyPage.nodeOps.addNode('DevToolsNodeWithLegacyWidget', undefined, {
      x: 0,
      y: 0
    })
    await comfyPage.appMode.enterAppModeWithInputs([['10', 'legacy_widget']])
  })

  const getWidth = () =>
    comfyPage.page.evaluate(
      () => graph!.getNodeById(10)!.widgets![0].width ?? 0
    )

  await test.step('Mouse clicks resolve to button regions', async () => {
    const legacyWidget = comfyPage.appMode.linearWidgets.locator('canvas')
    const { width, height } = (await legacyWidget.boundingBox())!

    const nodeRef = await comfyPage.nodeOps.getNodeRefById(10)
    const legacyWidgetRef = await nodeRef.getWidget(0)
    expect(await legacyWidgetRef.getValue()).toBe(0)
    await legacyWidget.click({ position: { x: 20, y: height / 2 } })
    await expect.poll(() => legacyWidgetRef.getValue()).toBe(-1)
    await legacyWidget.click({ position: { x: width - 20, y: height / 2 } })
    await expect.poll(() => legacyWidgetRef.getValue()).toBe(0)
  })

  await test.step('Resize to update width', async () => {
    const initialWidth = await getWidth()
    expect(initialWidth).toBeGreaterThan(0)

    const gutter = comfyPage.page.getByRole('separator')

    await expect(gutter).toBeVisible()
    await comfyMouse.resizeByDragging(gutter, { x: -200 })
    await expect.poll(getWidth).toBeGreaterThan(initialWidth)
    const intermediateWidth = await getWidth()

    await comfyMouse.resizeByDragging(gutter, { x: 100 })
    await expect.poll(getWidth).toBeLessThan(intermediateWidth)
  })
})
