import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test('In App Mode, widget width updates with panel size', async ({
  comfyPage,
  comfyMouse
}) => {
  await test.step('setup', async () => {
    //This tests breaks basically every assumption made by every fixture
    //A minimal widget is created since no core nodes use WidgetLegacy
    //No fixture exists for grabbing a widget's width
    //enterAppModeWithInputs serializes the graph, must setup widget after
    await comfyPage.appMode.enterAppModeWithInputs([['5', 'testWidget']])
    await comfyPage.page.evaluate(() => {
      graph!.getNodeById(5)!.widgets!.push({
        name: 'testWidget',
        type: 'TESTWIDGET',
        options: {},
        y: 0
      })
    })

    await comfyPage.appMode.toggleAppMode()
    await expect(comfyPage.appMode.linearWidgets).toBeHidden()
    await comfyPage.appMode.toggleAppMode()
    await expect(comfyPage.appMode.linearWidgets).toBeVisible()
  })

  const getWidth = () =>
    comfyPage.page.evaluate(() => {
      console.log(graph!.getNodeById(5)!.widgets![3])
      return graph!.getNodeById(5)!.widgets![3].width ?? 0
    })
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
