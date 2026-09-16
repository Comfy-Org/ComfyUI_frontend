import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'Vue Locked Widget Hover Styling',
  { tag: ['@vue-nodes', '@widget', '@screenshot'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow(
        'vueNodes/linked-string-widget-color'
      )
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    test('suppresses a field connected to an upstream node', async ({
      comfyPage
    }) => {
      const lockedInput = comfyPage.vueNodes.getWidgetByName(
        'Locked Widget Target',
        'text'
      )
      // The connected field is suppressed: only the standalone socket row
      // carries the accessible name, with no editable control.
      await expect(lockedInput).toHaveCount(1)
      await expect(lockedInput.getByTestId('slot-dot')).toBeVisible()
      await expect(lockedInput.locator('textarea, input')).toHaveCount(0)
    })

    test('editable field on the same node still shows the generic hover background', async ({
      comfyPage
    }) => {
      const sourceNode = comfyPage.vueNodes.getNodeByTitle('String Source')
      const editableInput = comfyPage.vueNodes.getWidgetByName(
        'String Source',
        'value'
      )

      await expect(editableInput).toBeVisible()
      await editableInput.hover()
      await comfyPage.expectScreenshot(
        sourceNode,
        'editable-widget-hover-color.png'
      )
    })
  }
)
