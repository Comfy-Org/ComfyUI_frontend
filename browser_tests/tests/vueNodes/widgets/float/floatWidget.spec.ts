import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { TestGraphAccess } from '@e2e/types/globals'

test.describe('Vue Float Widget', { tag: '@vue-nodes' }, () => {
  test('allows changing value via the number input', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('vueNodes/linked-int-widget')

    const cfgWidget = comfyPage.vueNodes
      .getWidgetByName('KSampler', 'cfg')
      .first()
    const { input } = comfyPage.vueNodes.getInputNumberControls(cfgWidget)

    await input.fill('3.5')
    await input.blur()

    await expect(input).toHaveValue('3.5')
  })

  test('increment and decrement buttons update the value', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('vueNodes/linked-int-widget')

    const denoiseWidget = comfyPage.vueNodes
      .getWidgetByName('KSampler', 'denoise')
      .first()
    const controls = comfyPage.vueNodes.getInputNumberControls(denoiseWidget)

    const initial = Number(await controls.input.inputValue())

    await controls.incrementButton.click()
    await expect(controls.input).not.toHaveValue(initial.toString())

    const afterIncrement = Number(await controls.input.inputValue())
    expect(afterIncrement).toBeGreaterThan(initial)

    await controls.decrementButton.click()
    await expect
      .poll(() => Number(controls.input.inputValue().then(Number)))
      .toBeLessThanOrEqual(afterIncrement)
  })

  test('persists value after the workflow is serialized and reloaded', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('vueNodes/linked-int-widget')

    const cfgWidget = comfyPage.vueNodes
      .getWidgetByName('KSampler', 'cfg')
      .first()
    const { input } = comfyPage.vueNodes.getInputNumberControls(cfgWidget)

    await input.fill('7.25')
    await input.blur()
    await expect(input).toHaveValue('7.25')

    const cfgValue = await comfyPage.page.evaluate(() => {
      const graph = window.graph as unknown as TestGraphAccess | undefined
      if (!graph) return null
      const node = Object.values(graph._nodes_by_id).find(
        (n) => n.type === 'KSampler'
      )
      return node?.widgets?.find((w) => w.name === 'cfg')?.value ?? null
    })

    expect(cfgValue).toBe(7.25)
  })
})
