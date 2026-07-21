import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyNodeDef, InputSpec } from '@/schemas/nodeDefSchema'

// BUG-020: a widget tooltip that joins a short label and a long value with a
// blank line collapsed onto a single line because the tooltip text had no
// whitespace-preserving rule. Reproduce that shape (label + blank line + long
// value) and assert the rendered tooltip keeps them on separate lines and stays
// within the widened width bound.
const WIDGET_LABEL = 'Detection prompt for the segmentation model.'
const LONG_VALUE =
  'a very long default detection value that keeps going and going and going ' +
  'so it has to wrap across several lines while remaining readable inside the ' +
  'bounded tooltip surface'
const TOOLTIP_TEXT = `${WIDGET_LABEL}\n\n${LONG_VALUE}`

// max-w-96 === 24rem === 384px at the default 16px root font size.
const MAX_TOOLTIP_WIDTH = 384

type ObjectInfoResponse = Record<string, ComfyNodeDef>

test.describe('Vue Node Widget Tooltip', { tag: '@vue-nodes' }, () => {
  test('renders a long widget tooltip with label and value on separate lines within bounds', async ({
    comfyPage
  }) => {
    await comfyPage.page.route(/\/object_info$/, async (route) => {
      const response = await route.fetch()
      const objectInfo = (await response.json()) as ObjectInfoResponse
      const required = objectInfo.DevToolsNodeWithStringInput?.input?.required
      if (required?.string_input) {
        const patchedInput: InputSpec = ['STRING', { tooltip: TOOLTIP_TEXT }]
        required.string_input = patchedInput
      }
      await route.fulfill({ response, json: objectInfo })
    })
    // Reload so the patched object_info (with the multi-line tooltip) is the one
    // the node definition store boots from.
    await comfyPage.workflow.reloadAndWaitForApp()

    // Enable tooltips before the widget mounts: the v-tooltip directive reads
    // its disabled state once at mount, so the setting must be on beforehand.
    await comfyPage.settings.setSetting('Comfy.EnableTooltips', true)
    await comfyPage.workflow.loadWorkflow('inputs/string_input')

    const widget = comfyPage.vueNodes
      .getWidgetByName('Node With String Input', 'string_input')
      .first()
    await widget.hover()

    const tooltipText = comfyPage.page.locator('.p-tooltip-text:visible')
    await expect(tooltipText).toBeVisible()

    // Behavioral check: whitespace-pre-line preserves the blank-line separator,
    // so innerText keeps the label and value on distinct lines with an empty
    // line between them instead of collapsing them onto one (the BUG-020
    // regression).
    const renderedText = await tooltipText.evaluate(
      (el) => (el as HTMLElement).innerText
    )
    const [labelLine, separatorLine, ...valueLines] = renderedText.split('\n')
    expect(labelLine.trim()).toBe(WIDGET_LABEL)
    expect(separatorLine.trim()).toBe('')
    expect(valueLines.join('\n').trim()).toBe(LONG_VALUE)

    // Width stays bounded by max-w-96 so the long value wraps rather than
    // stretching the tooltip off-screen.
    const box = await tooltipText.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeLessThanOrEqual(MAX_TOOLTIP_WIDTH)
  })
})
