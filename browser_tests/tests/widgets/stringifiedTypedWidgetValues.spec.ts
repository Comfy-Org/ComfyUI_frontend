import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'

test.describe(
  'Typed widget values saved as strings',
  {
    tag: ['@canvas', '@widget'],
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
  }
)
