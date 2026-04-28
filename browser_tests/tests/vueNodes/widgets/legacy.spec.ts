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

  const getWidth = () => comfyPage.page.evaluate(
    () => graph!.getNodeById(10)!.widgets![0].width ?? 0
  )
  console.error(await comfyPage.page.evaluate(() => graph.nodes.map(n => n.serialize())))
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
