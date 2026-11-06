import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

test.describe('Vue Integer Widget', { tag: '@vue-nodes' }, () => {
  test('reclaims numeric draft width after keyboard stepping', async ({
    comfyPage
  }) => {
    const [node] = await comfyPage.nodeOps.getNodeRefsByType('KSampler')
    await node.centerOnNode()
    const row = comfyPage.vueNodes.getWidgetRowByLabel('KSampler', 'steps')
    const input = row.getByRole('spinbutton', { name: 'steps' })

    await input.fill('123456789012345')
    await expect(input).toHaveValue('123456789012345')
    const draftBounds = (await input.boundingBox())!

    await input.press('ArrowUp')

    await expect(input).toHaveValue('21')
    await expect(async () => {
      const steppedBounds = (await input.boundingBox())!
      expect(steppedBounds.width).toBeLessThan(draftBounds.width - 50)
    }).toPass({ timeout: 5000 })
    await expect(row.getByText('steps', { exact: true })).toBeVisible()

    await test.step('Narrow the node so the seed label yields before its committed value', async () => {
      const seedRow = comfyPage.vueNodes.getWidgetRowByLabel('KSampler', 'seed')
      const seedInput = seedRow.getByRole('spinbutton', { name: 'seed' })
      const label = seedRow.getByTestId(TestIds.widgets.layoutFieldLabel)
      await seedInput.fill('9007199254740991')
      await seedInput.press('Enter')
      await seedInput.blur()
      await expect(seedInput).toHaveValue('9007199254740991')

      const nodeFixture = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
      const width = await nodeFixture.root.evaluate(
        (element) => element.getBoundingClientRect().width
      )
      await nodeFixture.resizeFromCorner('SE', 260 - width, 0)
      await comfyPage.nextFrame()

      await expect
        .poll(() =>
          label.evaluate((element) => element.scrollWidth - element.clientWidth)
        )
        .toBeGreaterThan(0)
      await expect
        .poll(() =>
          seedInput.evaluate(
            (element) => element.scrollWidth - element.clientWidth
          )
        )
        .toBeLessThanOrEqual(1)
      await expect(seedInput).toHaveValue('9007199254740991')
    })
  })

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
    await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
    await comfyPage.searchBoxV2.addNode('Int')
    const widget = comfyPage.vueNodes.getWidgetRowByLabel('Int', 'value')
    await expect(widget).toBeVisible()

    const { valueControl } = comfyPage.vueNodes.getInputNumberControls(widget)
    await expect(valueControl).toBeVisible()
  })
})
