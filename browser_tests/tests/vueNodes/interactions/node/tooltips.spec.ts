import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { Tooltip } from '@e2e/fixtures/components/Tooltip'
import { TestIds } from '@e2e/fixtures/selectors'

test.describe('tooltips', { tag: '@vue-nodes' }, async () => {
  test.use({
    initialSettings: {
      'Comfy.EnableTooltips': true,
      'LiteGraph.Node.TooltipDelay': 0
    }
  })

  test('widget value tooltips', async ({ comfyPage }) => {
    const tooltip = new Tooltip(comfyPage.page).open
    await comfyPage.vueNodes.getWidgetByName('load check', 'ckpt_name').hover()
    await expect(tooltip, 'displays for combos').toContainText('v1-5-pruned')

    await comfyPage.vueNodes.getWidgetRowByLabel('ksampler', 'seed').hover()
    await expect(tooltip, 'displays for numbers').toContainText('15668')

    await comfyPage.vueNodes
      .getNodeLocator('6')
      .getByRole('textbox', { name: 'text', exact: true })
      .hover()
    await expect(tooltip).toBeVisible()
    await expect(tooltip, "doesn't display for prompts").not.toContainText(
      'purple galaxy bottle'
    )
  })

  for (const widgetTop of [350, 44]) {
    test(`keeps widget hints clear of the slot drop area at y=${widgetTop}`, async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
      const node = await comfyPage.nodeOps.getNodeRefById('3')
      await node.centerOnNode()
      const row = comfyPage.vueNodes.getWidgetRowByLabel('KSampler', 'steps')
      const rowBox = await row.boundingBox()
      expect(rowBox).not.toBeNull()
      await comfyPage.canvasOps.pan(
        { x: 0, y: widgetTop - rowBox!.y },
        { x: 1000, y: 400 }
      )

      await row.hover()
      const tooltips = new Tooltip(comfyPage.page)
      const hint = tooltips.surface(tooltips.open)
      await expect(tooltips.open).toContainText('denoising')

      await expect(async () => {
        const hintBox = await hint.boundingBox()
        const slotBox = await row
          .getByTestId(TestIds.node.slotConnectionDot)
          .boundingBox()
        expect(hintBox).not.toBeNull()
        expect(slotBox).not.toBeNull()
        expect(
          hintBox!.y + hintBox!.height <= slotBox!.y ||
            hintBox!.y >= slotBox!.y + slotBox!.height
        ).toBe(true)
        expect(hintBox!.y).toBeGreaterThanOrEqual(0)
        expect(hintBox!.y + hintBox!.height).toBeLessThanOrEqual(
          comfyPage.page.viewportSize()!.height
        )
      }).toPass({ timeout: 5000 })
    })
  }

  test('truncated collapsed title shows in full', async ({ comfyPage }) => {
    const longTitle = 'Sampler with a title far too long for its header'
    const node = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
    await node.setTitle(longTitle)
    await node.toggleCollapse()

    await node.title.hover()
    await expect(new Tooltip(comfyPage.page).open).toContainText(longTitle)
  })
})
