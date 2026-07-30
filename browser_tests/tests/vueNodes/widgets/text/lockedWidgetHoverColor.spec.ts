import type { Locator } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

const getBackgroundColor = (locator: Locator) =>
  locator.evaluate((el) => getComputedStyle(el).backgroundColor)

test.describe(
  'Vue Locked Widget Hover Styling',
  { tag: ['@vue-nodes', '@widget'] },
  () => {
    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    test('keeps a locked field on a custom-colored node the same on hover instead of turning generic gray', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'vueNodes/linked-string-widget-color'
      )

      const lockedInput = comfyPage.vueNodes.getWidgetByName(
        'Locked Widget Target',
        'filename_prefix'
      )
      const editableInput = comfyPage.vueNodes.getWidgetByName(
        'String Source',
        'value'
      )

      await expect(lockedInput).toHaveAttribute('readonly', '')

      const lockedRestColor = await getBackgroundColor(lockedInput)

      // Hovering the locked field must not replace its (node-color-tinted)
      // background with the app's opaque generic hover gray.
      await lockedInput.hover()
      await expect
        .poll(() => getBackgroundColor(lockedInput))
        .toBe(lockedRestColor)

      // Sanity check: hover styling still works for editable fields, and
      // produces a color distinct from the locked field's.
      await editableInput.hover()
      await expect
        .poll(() => getBackgroundColor(editableInput))
        .not.toBe(lockedRestColor)
    })
  }
)
