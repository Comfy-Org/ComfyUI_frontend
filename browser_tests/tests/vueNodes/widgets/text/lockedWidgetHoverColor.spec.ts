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

    test('keeps a locked field on a custom-colored node the same on hover instead of turning generic gray', async ({
      comfyPage
    }) => {
      const targetNode = comfyPage.vueNodes.getNodeByTitle(
        'Locked Widget Target'
      )
      const lockedInput = comfyPage.vueNodes.getWidgetByName(
        'Locked Widget Target',
        'text'
      )
      // proxy check: covers both link-locked and hardcoded read_only cases
      await expect(lockedInput).toHaveAttribute('readonly', '')

      // Hovering the locked field must not replace its (node-color-tinted)
      // background with the app's opaque generic hover gray, so the node's
      // custom color should still show through in the screenshot.
      //
      // The native `disabled` attribute on the locked textarea makes it
      // `pointer-events: none` (see Textarea.vue's `disabled:pointer-events-none`
      // class), so the browser never delivers pointer events to it directly —
      // hovering must instead target its parent, which is the actual element
      // carrying the hover background class this test is verifying.
      await lockedInput.locator('..').hover()
      await comfyPage.expectScreenshot(
        targetNode,
        'locked-widget-hover-color.png'
      )
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
