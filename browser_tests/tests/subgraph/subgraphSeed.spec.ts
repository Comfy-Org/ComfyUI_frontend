import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { queuedExecutionFixture as test } from '@e2e/fixtures/queuedExecutionFixture'

test.use({ initialSettings: { 'Comfy.Minimap.Visible': false } })

test(
  'Seed handling',
  { tag: '@vue-nodes' },
  async ({ comfyPage, queuedExecution }) => {
    async function verifySeedControl(initializeState = true) {
      const seedWidget = comfyPage.vueNodes.getWidgetRowByLabel('', 'seed')
      const { input, valueControl } =
        comfyPage.vueNodes.getInputNumberControls(seedWidget)

      if (initializeState) {
        await input.fill('1')
        await input.blur()
        await valueControl.click()
        await comfyPage.page.getByRole('radio', { name: 'increment' }).click()
        await comfyPage.keyboard.press('Escape')
      }

      const job = await queuedExecution.capture(() =>
        comfyPage.runButton.click()
      )
      job.start()
      job.finish()
      await expect.soft(input).toHaveValue('2')
    }

    await test.step('seed updates on generation', async () => {
      await verifySeedControl()
    })

    await test.step('subgraph seed updates on generation', async () => {
      await comfyPage.subgraph.convertDefaultKSamplerToSubgraph()
      await verifySeedControl()
    })

    for (const w of ['link-seed', 'proxy-seed', 'zit-seed']) {
      await test.step(`seed updates for old workflow: ${w}`, async () => {
        await comfyPage.workflow.loadWorkflow('subgraphs/' + w)
        await verifySeedControl(false)
      })
    }
  }
)
