import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'

test.describe(
  'Numeric widget values saved as strings',
  { tag: ['@canvas', '@widget'] },
  () => {
    test('load as numbers and are queued as numbers', async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow(
        'widgets/stringified_numeric_widget_values'
      )

      const latent = await comfyPage.nodeOps.getNodeRefById(5)
      const sampler = await comfyPage.nodeOps.getNodeRefById(3)
      await expect
        .poll(async () => (await latent.getWidgetByName('width')).getValue())
        .toBe(512)
      await expect
        .poll(async () => (await latent.getWidgetByName('height')).getValue())
        .toBe(768)
      await expect
        .poll(async () => (await sampler.getWidgetByName('steps')).getValue())
        .toBe(20)
      await expect
        .poll(async () => (await sampler.getWidgetByName('cfg')).getValue())
        .toBe(7.5)

      let requestBody: unknown
      const execution = new ExecutionHelper(comfyPage)
      await expect(
        execution.run({
          onPromptRequest: (body) => {
            requestBody = body
          }
        })
      ).resolves.toMatch(/^test-job-/)

      expect(requestBody).toMatchObject({
        prompt: {
          '5': { inputs: { width: 512, height: 768 } },
          '3': { inputs: { steps: 20, cfg: 7.5 } }
        }
      })
    })
  }
)
