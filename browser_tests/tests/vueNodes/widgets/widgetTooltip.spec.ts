import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import {
  routeObjectInfoFromSetupApi,
  setStringInputTooltip
} from '@e2e/fixtures/utils/objectInfo'

// max-w-96 === 24rem === 384px at the default 16px root font size.
const MAX_TOOLTIP_WIDTH = 384
const label = 'Detection prompt for the segmentation model.'
const longValue =
  'a very long default detection value that keeps going and going and going ' +
  'so it has to wrap across several lines while remaining readable inside the ' +
  'bounded tooltip surface'
const tooltipContent = `${label}\n\n${longValue}`

const test = comfyPageFixture.extend({
  page: async ({ page }, use) => {
    const unrouteObjectInfo = await routeObjectInfoFromSetupApi(
      page,
      (objectInfo) =>
        setStringInputTooltip(
          objectInfo,
          'DevToolsNodeWithStringInput',
          'string_input',
          tooltipContent
        )
    )

    try {
      await use(page)
    } finally {
      await unrouteObjectInfo()
    }
  }
})

test.describe('Vue Node Widget Tooltip', { tag: '@vue-nodes' }, () => {
  test.use({
    initialSettings: {
      'Comfy.EnableTooltips': true
    }
  })

  // BUG-020: a widget tooltip that joins a short label and a long value with a
  // blank line collapsed onto a single line because the tooltip text had no
  // whitespace-preserving rule. Reproduce that shape (label + blank line + long
  // value) and assert the rendered tooltip keeps them on separate lines and
  // stays within the widened width bound.
  test('renders a long widget tooltip with label and value on separate lines within bounds', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('inputs/string_input')

    const widget = comfyPage.vueNodes
      .getWidgetByName('Node With String Input', 'string_input')
      .first()
    await widget.hover()

    const tooltipText = comfyPage.vueNodes.getVisibleWidgetTooltip()
    await expect(tooltipText).toBeVisible()

    // Behavioral check: whitespace-pre-line preserves the blank-line separator,
    // so innerText keeps the label and value on distinct lines with an empty
    // line between them instead of collapsing them onto one (the BUG-020
    // regression).
    const renderedText = await tooltipText.evaluate(
      (el) => (el as HTMLElement).innerText
    )
    const [labelLine, separatorLine, ...valueLines] = renderedText.split('\n')
    expect(labelLine.trim()).toBe(label)
    expect(separatorLine.trim()).toBe('')
    expect(valueLines.join('\n').trim()).toBe(longValue)

    const width = await tooltipText.evaluate(
      (el) => (el as HTMLElement).getBoundingClientRect().width
    )
    expect(width).toBeLessThanOrEqual(MAX_TOOLTIP_WIDTH)
  })
})
