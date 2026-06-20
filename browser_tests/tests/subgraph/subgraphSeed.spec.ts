import { mergeTests } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'

const wstest = mergeTests(test, webSocketFixture)

wstest(
  'Seed handling',
  { tag: '@vue-nodes' },
  async ({ comfyPage, getWebSocket }) => {
    const execution = new ExecutionHelper(comfyPage, await getWebSocket())

    async function verifySeedControl(initializeState = true) {
      const seedWidget = comfyPage.vueNodes.getWidgetByName('', 'seed')
      const { input, valueControl } =
        comfyPage.vueNodes.getInputNumberControls(seedWidget)

      if (initializeState) {
        await input.fill('1')
        await valueControl.click()
        await comfyPage.page.getByRole('radio', { name: 'increment' }).click()
        await comfyPage.keyboard.press('Escape')
      }

      await execution.run()
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
