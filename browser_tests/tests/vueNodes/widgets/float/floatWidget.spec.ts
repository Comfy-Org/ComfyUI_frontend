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

    // cfg has room to grow (initial 8, max 100); denoise is at its max (1)
    // so its increment button is disabled and can't be used here.
    const cfgWidget = comfyPage.vueNodes
      .getWidgetByName('KSampler', 'cfg')
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
      .getWidgetByName('KSampler', 'cfg')
      .first()
    const { input } = comfyPage.vueNodes.getInputNumberControls(cfgWidget)

    // KSampler's cfg is precision=1, so pick a value that lands on the grid
    await input.fill('7.5')
    await input.blur()
    await expect(input).toHaveValue('7.5')

    const serialized = await comfyPage.workflow.getExportedWorkflow()
    await comfyPage.workflow.loadGraphData(serialized)
    await comfyPage.vueNodes.waitForNodes()

    const cfgValueAfterReload = await comfyPage.page.evaluate(() => {
      const graph = window.graph as unknown as TestGraphAccess | undefined
      if (!graph) return null
      const node = Object.values(graph._nodes_by_id).find(
        (n) => n.type === 'KSampler'
      )
      return node?.widgets?.find((w) => w.name === 'cfg')?.value ?? null
    })

    expect(cfgValueAfterReload).toBe(7.5)
  })
})
