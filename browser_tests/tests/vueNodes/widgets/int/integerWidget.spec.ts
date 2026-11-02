import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('Vue Integer Widget', { tag: '@vue-nodes' }, () => {
  test('should be suppressed while linked and editable after unlinking', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('vueNodes/linked-int-widget')

    const seedWidget = comfyPage.vueNodes.getWidgetByName('KSampler', 'seed')
    const ksampler = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
    const seedSlot = ksampler.getSlot('seed')

    await expect(seedWidget).toHaveCount(1)
    await expect(seedWidget.getByTestId('slot-dot')).toBeVisible()
    await expect(seedWidget.locator('input')).toHaveCount(0)
    await expect
      .poll(() => comfyPage.vueNodes.isSlotConnected(seedSlot))
      .toBe(true)

    await comfyPage.vueNodes
      .getNodeByTitle('Int')
      .locator('.lg-node-header')
      .click()
    await comfyPage.vueNodes.deleteSelected()

    await expect(seedWidget).toBeVisible()
    const controls = comfyPage.vueNodes.getInputNumberControls(
      comfyPage.vueNodes.getWidgetRowByLabel('KSampler', 'seed')
    )
    await expect(controls.input).toBeEnabled()
    const initialValue = Number(await controls.input.inputValue())
    await controls.incrementButton.click()
    await expect(controls.input).toHaveValue((initialValue + 1).toString())

    await controls.decrementButton.click()
    await expect(controls.input).toHaveValue(initialValue.toString())
  })

  test('displays control widgets with default state', async ({ comfyPage }) => {
    await comfyPage.menu.topbar.newWorkflowButton.click()
    await comfyPage.nextFrame()
    await comfyPage.searchBoxV2.addNode('Int')
    const widget = comfyPage.vueNodes.getWidgetRowByLabel('Int', 'value')
    await expect(widget).toBeVisible()

    const { valueControl } = comfyPage.vueNodes.getInputNumberControls(widget)
    await expect(valueControl).toBeVisible()
  })
})
