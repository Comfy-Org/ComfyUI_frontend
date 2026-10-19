import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'

test.describe(
  'Typed widget values saved as strings',
  {
    tag: ['@canvas', '@screenshot', '@widget'],
    annotation: {
      type: 'issue',
      description:
        'https://linear.app/comfyorg/issue/PM-2173/templates-load-with-a-widget-type-bug-and-fail-validation-costing'
    }
  },
  () => {
    test('load with declared types and queue numbers', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'widgets/stringified_typed_widget_values'
      )

      let requestBody: unknown
      const execution = new ExecutionHelper(comfyPage)
      await execution.run({
        onPromptRequest: (body) => {
          requestBody = body
        }
      })

      expect(requestBody).toMatchObject({
        prompt: {
          '5': { inputs: { width: 512, height: 768 } },
          '3': { inputs: { steps: 20, cfg: 7.5 } },
          '10': { inputs: { boolean_input: false } }
        }
      })
    })

    test('render and toggle a restored boolean value', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'widgets/stringified_typed_widget_values'
      )

      const booleanNode = await comfyPage.nodeOps.getNodeRefById(10)
      const booleanWidget = await booleanNode.getWidgetByName('boolean_input')
      await expect.poll(() => booleanWidget.getValue()).toBe(false)
      await expect(comfyPage.page).toHaveScreenshot(
        'stringified-boolean-widget.png',
        { clip: { x: 56, y: 270, width: 300, height: 100 } }
      )

      await booleanWidget.click()

      await expect.poll(() => booleanWidget.getValue()).toBe(true)
      await expect(comfyPage.page).toHaveScreenshot(
        'stringified-boolean-widget-toggled.png',
        { clip: { x: 56, y: 270, width: 300, height: 100 } }
      )
    })
  }
)
