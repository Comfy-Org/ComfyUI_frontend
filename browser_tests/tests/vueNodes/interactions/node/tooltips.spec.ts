import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('tooltips', { tag: '@vue-nodes' }, async () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.EnableTooltips', true)
    await comfyPage.settings.setSetting('LiteGraph.Node.TooltipDelay', 0)
  })

  test('widget value tooltips', async ({ comfyPage }) => {
    const tooltip = comfyPage.page.locator('.p-tooltip-text')
    await comfyPage.vueNodes.getWidgetByName('load check', 'ckpt_name').hover()
    await expect(tooltip, 'displays for combos').toContainText('v1-5-pruned')

    await comfyPage.vueNodes.getWidgetByName('ksampler', 'seed').hover()
    await expect(tooltip, 'displays for numbers').toContainText('15668')

    await comfyPage.vueNodes.getNodeLocator('6').getByLabel('text').hover()
    await expect(tooltip).toBeVisible()
    await expect(tooltip, "doesn't display for prompts").not.toContainText(
      'purple galaxy bottle'
    )
  })
})
