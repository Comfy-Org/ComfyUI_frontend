import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('Vue Float Widget', { tag: '@vue-nodes' }, () => {
  for (const type of ['slider', 'gradientslider'] as const) {
    test(`${type} retains a usable drag range`, async ({ comfyPage }) => {
      await comfyPage.page.evaluate((widgetType) => {
        const node = window.app!.graph.nodes.find(
          (node) => node.type === 'KSampler'
        )!
        node.addWidget(widgetType, 'strength', 0.25, () => {}, {
          min: 0,
          max: 1,
          precision: 2
        })
      }, type)
      const [node] = await comfyPage.nodeOps.getNodeRefsByType('KSampler')
      await node.centerOnNode()
      const slider = comfyPage.vueNodes
        .getWidgetRowByLabel('KSampler', 'strength')
        .getByRole('slider')
      await expect(slider).toHaveAttribute('aria-valuenow', '0.25')
      await slider.hover()
      const box = (await slider.boundingBox())!
      await comfyPage.page.mouse.down()
      await comfyPage.page.mouse.move(box.x + 40, box.y + box.height / 2, {
        steps: 10
      })
      await comfyPage.page.mouse.up()
      await expect
        .poll(async () => Number(await slider.getAttribute('aria-valuenow')))
        .toBeGreaterThan(0.25)
      await expect
        .poll(async () => Number(await slider.getAttribute('aria-valuenow')))
        .toBeLessThan(1)
    })
  }

  test('steps the Float primitive by the increment its node definition declares', async ({
    comfyPage
  }) => {
    const floatNode = await comfyPage.nodeOps.addNode(
      'PrimitiveFloat',
      {},
      { x: 400, y: 200 }
    )

    const valueWidget = comfyPage.vueNodes
      .getWidgetRowByLabel('Float', 'value')
      .first()
    const controls = comfyPage.vueNodes.getInputNumberControls(valueWidget)

    await expect(controls.input).toHaveValue('0.0')

    await controls.incrementButton.click()
    await expect(controls.input).toHaveValue('0.1')

    await controls.incrementButton.click()
    await expect(controls.input).toHaveValue('0.2')

    await controls.decrementButton.click()
    await expect(controls.input).toHaveValue('0.1')

    const graphWidget = await floatNode.getWidgetByName('value')
    await expect.poll(() => graphWidget.getValue()).toBe(0.1)
  })

  test('evaluates expression input using the widget precision', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('vueNodes/linked-int-widget')

    const cfgWidget = comfyPage.vueNodes
      .getWidgetRowByLabel('KSampler', 'cfg')
      .first()
    const { input } = comfyPage.vueNodes.getInputNumberControls(cfgWidget)

    await input.fill('2.1 + 1.23')
    await input.blur()

    await expect(input).toHaveValue('3.3')
  })

  test('increment and decrement buttons update the value', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('vueNodes/linked-int-widget')

    const cfgWidget = comfyPage.vueNodes
      .getWidgetRowByLabel('KSampler', 'cfg')
      .first()
    const controls = comfyPage.vueNodes.getInputNumberControls(cfgWidget)

    const initial = Number(await controls.input.inputValue())

    await controls.incrementButton.click()
    await expect
      .poll(async () => Number(await controls.input.inputValue()))
      .toBeGreaterThan(initial)
    const afterIncrement = Number(await controls.input.inputValue())

    await controls.decrementButton.click()
    await expect
      .poll(async () => Number(await controls.input.inputValue()))
      .toBeLessThan(afterIncrement)
  })

  test('persists value across a serialize and reload round-trip', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('vueNodes/linked-int-widget')

    const cfgWidget = comfyPage.vueNodes
      .getWidgetRowByLabel('KSampler', 'cfg')
      .first()
    const { input } = comfyPage.vueNodes.getInputNumberControls(cfgWidget)

    await input.fill('7.5')
    await input.blur()
    await expect(input).toHaveValue('7.5')

    const serialized = await comfyPage.workflow.getExportedWorkflow()
    await comfyPage.workflow.loadGraphData(serialized)

    const [ksamplerNode] = await comfyPage.nodeOps.getNodeRefsByType('KSampler')

    const cfgWidgetAfterReload = await ksamplerNode.getWidgetByName('cfg')
    await expect.poll(() => cfgWidgetAfterReload.getValue()).toBe(7.5)

    await expect(input).toHaveValue('7.5')
  })
})
