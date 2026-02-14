import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../../../fixtures/ComfyPage'

test.describe('Image Dropdown Virtualization', { tag: '@widget' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.vueNodes.waitForNodes()
  })

  test('should virtualize items when dropdown has many entries', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow('widgets/load_image_widget')
    await comfyPage.vueNodes.waitForNodes()

    const totalItems = await comfyPage.page.evaluate(() => {
      const node = window['graph']._nodes_by_id['10']
      const widget = node.widgets.find(
        (w: { name: string }) => w.name === 'image'
      )
      const count = 60
      const values = Array.from(
        { length: count },
        (_, i) => `test_image_${i}.png`
      )
      widget.options.values = values
      widget.value = values[0]
      return count
    })

    const loadImageNode = comfyPage.vueNodes.getNodeByTitle('Load Image')
    const dropdownButton = loadImageNode.locator(
      'button:has(span:has-text("test_image_0.png"))'
    )
    await dropdownButton.waitFor({ state: 'visible' })
    await dropdownButton.click()

    const virtualGridItems = comfyPage.page.locator('[data-virtual-grid-item]')
    await expect(virtualGridItems.first()).toBeVisible()

    const renderedCount = await virtualGridItems.count()
    expect(renderedCount).toBeLessThan(totalItems)
    expect(renderedCount).toBeGreaterThan(0)
  })
})
