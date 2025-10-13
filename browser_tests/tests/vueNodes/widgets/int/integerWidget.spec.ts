import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../../../../fixtures/ComfyPage'

test.describe('Vue Integer Widget', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.setup()
  })

  test('should be disabled and not allow changing value when link connected to slot', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow('vueNodes/linked-int-widget')
    await comfyPage.vueNodes.waitForNodes()

    const seedWidget = comfyPage.vueNodes.getWidgetByName('KSampler', 'seed')
    const controls = comfyPage.vueNodes.getInputNumberControls(seedWidget)
    const initialValue = Number(await controls.input.inputValue())

    // Verify widget is disabled when linked
    await controls.incrementButton.click({ force: true })
    await expect(controls.input).toHaveValue(initialValue.toString())

    await controls.decrementButton.click({ force: true })
    await expect(controls.input).toHaveValue(initialValue.toString())

    await expect(seedWidget).toBeVisible()

    // Delete the node that is linked to the slot (freeing up the widget)
    await comfyPage.vueNodes.getNodeByTitle('Int').click()
    await comfyPage.vueNodes.deleteSelected()

    // Test widget works when unlinked
    await controls.incrementButton.click()
    await expect(controls.input).toHaveValue((initialValue + 1).toString())

    await controls.decrementButton.click()
    await expect(controls.input).toHaveValue(initialValue.toString())
  })
})
