import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

test.describe('Vue Integer Widget', { tag: '@vue-nodes' }, () => {
  test('should hide a linked value and restore the control after disconnect', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('vueNodes/linked-int-widget')

    const samplerNode = comfyPage.vueNodes.getNodeByTitle('KSampler').first()
    const placeholder = samplerNode.getByTestId(
      TestIds.widgets.linkedPlaceholder
    )
    const linkedContent = samplerNode.getByTestId(TestIds.widgets.linkedContent)
    const hiddenInput = linkedContent.locator('input[role="spinbutton"]')
    const nodeBounds = await samplerNode.boundingBox()
    const [samplerNodeRef] =
      await comfyPage.nodeOps.getNodeRefsByType('KSampler')
    if (!samplerNodeRef || !nodeBounds) {
      throw new Error('Linked KSampler node did not render')
    }
    const seedWidgetRef = await samplerNodeRef.getWidgetByName('seed')
    const initialValue = Number(await seedWidgetRef.getValue())

    await expect(placeholder).toHaveAccessibleName('seed: Linked input')
    await expect(linkedContent).toHaveAttribute('inert', '')
    await expect(hiddenInput).toBeDisabled()
    await expect(
      samplerNode.getByRole('spinbutton', { name: 'seed' })
    ).toHaveCount(0)
    await placeholder.click()
    await expect.poll(() => seedWidgetRef.getValue()).toBe(initialValue)

    await comfyPage.vueNodes
      .getNodeByTitle('Int')
      .locator('.lg-node-header')
      .click()
    await comfyPage.vueNodes.deleteSelected()

    await expect(placeholder).toHaveCount(0)
    const seedWidget = comfyPage.vueNodes
      .getWidgetByName('KSampler', 'seed')
      .first()
    const controls = comfyPage.vueNodes.getInputNumberControls(seedWidget)
    await expect(controls.input).toHaveValue(initialValue.toString())
    await controls.incrementButton.click()
    await expect(controls.input).toHaveValue((initialValue + 1).toString())

    await controls.decrementButton.click()
    await expect(controls.input).toHaveValue(initialValue.toString())
    await expect
      .poll(async () => (await samplerNode.boundingBox())?.height)
      .toBeCloseTo(nodeBounds.height, 0)
  })

  test('displays control widgets with default state', async ({ comfyPage }) => {
    await comfyPage.menu.topbar.newWorkflowButton.click()
    await comfyPage.nextFrame()
    await comfyPage.searchBoxV2.addNode('Int')
    const widget = comfyPage.vueNodes.getWidgetByName('Int', 'value')
    await expect(widget).toBeVisible()

    const { valueControl } = comfyPage.vueNodes.getInputNumberControls(widget)
    await expect(valueControl).toBeVisible()
  })
})
