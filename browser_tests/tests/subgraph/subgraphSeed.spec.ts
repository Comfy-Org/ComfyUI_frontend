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

    async function verifySeedControl() {
      const seedWidget = comfyPage.vueNodes.getWidgetByName('', 'seed')
      const { input, valueControl } =
        comfyPage.vueNodes.getInputNumberControls(seedWidget)

      await input.fill('1')
      await valueControl.click()
      await comfyPage.page.getByRole('radio', { name: 'increment' }).click()
      await comfyPage.keyboard.press('Escape')

      await execution.run()
      await expect(input).toHaveValue('2')
    }

    await test.step('seed updates on generation', async () => {
      await verifySeedControl()
    })

    await test.step('subgraph seed updates on generation', async () => {
      await comfyPage.subgraph.convertDefaultKSamplerToSubgraph()
      await verifySeedControl()
    })
  }
)
