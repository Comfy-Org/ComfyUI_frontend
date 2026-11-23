import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { Tooltip } from '@e2e/fixtures/components/Tooltip'
import { TestIds } from '@e2e/fixtures/selectors'
import { setupBuilder } from '@e2e/fixtures/utils/builderTestUtils'

test.describe('tooltips', { tag: '@vue-nodes' }, async () => {
  test.use({
    viewport: { width: 1920, height: 1080 },
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

    await test.step('switch slot content and placement, then dismiss on pointerdown', async () => {
      const slots = new Tooltip(comfyPage.page)
      await comfyPage.vueNodes.getInputSlotRow('3', 0).hover()
      await expect(tooltip).toHaveText(
        'The model used for denoising the input latent.'
      )
      await expect(slots.surface(tooltip)).toHaveAttribute('data-side', 'left')

      await comfyPage.vueNodes.getOutputSlotRow('3', 0).hover()
      await expect(tooltip).toHaveText('The denoised latent.')
      await expect(slots.surface(tooltip)).toHaveAttribute('data-side', 'right')
      await comfyPage.page.mouse.down()
      await expect(tooltip).toBeHidden()
      await comfyPage.page.mouse.up()
    })
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

  test('shows widget hints in the subgraph input panel', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/agent-subgraph-with-two-promoted-widgets',
      {
        nodes: { 11: { widgets_values: ['a photo of a pier', 1234567890123] } }
      }
    )
    await comfyPage.vueNodes.enterSubgraph('11')
    const seed = comfyPage.vueNodes.getWidgetRowByLabel(
      comfyPage.subgraph.inputPanel,
      'seed'
    )

    await seed.hover()

    await expect(new Tooltip(comfyPage.page).open).toContainText(
      '1234567890123'
    )
  })

  test('shows widget hints after leaving the builder preview for the App', async ({
    comfyPage
  }) => {
    await setupBuilder(comfyPage, undefined, ['steps'])
    await comfyPage.appMode.steps.goToPreview()
    await comfyPage.page
      .getByRole('button', { name: 'View app', exact: true })
      .click()
    const steps = comfyPage.appMode.widgets
      .getWidgetItem('3:steps')
      .getByTestId(TestIds.widgets.widget)

    await steps.hover()

    await expect(new Tooltip(comfyPage.page).open).toContainText(
      'The number of steps used in the denoising process.'
    )
  })

  test('truncated title tooltip closes while editing and after deletion', async ({
    comfyPage
  }) => {
    const longTitle = 'Sampler with a title far too long for its header'
    const node = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
    const tooltip = new Tooltip(comfyPage.page).open
    await node.setTitle(longTitle)
    await node.toggleCollapse()

    await test.step('show the full title above the description', async () => {
      await node.title.hover()
      await expect(tooltip).toContainText(longTitle)
      await expect(tooltip).toContainText(
        'Uses the provided model, positive and negative conditioning to denoise the latent image.'
      )
      await expect(tooltip.getByText(longTitle)).toHaveCSS('font-weight', '600')
    })

    await test.step('suppress both tooltip lines during editing', async () => {
      await node.title.dblclick()
      await expect(node.titleEditor.input).toBeVisible()
      await node.title.hover()
      await expect(tooltip).toBeHidden()
      await node.titleEditor.input.press('Escape')
    })

    await test.step('remove the hovered target without moving the pointer', async () => {
      await node.select()
      await comfyPage.page.mouse.move(0, 0)
      await node.title.hover()
      await expect(tooltip).toBeVisible()
      await comfyPage.page.keyboard.press('Delete')
      await expect(node.root).toBeHidden()
      await expect(tooltip).toBeHidden()
    })
  })
})
