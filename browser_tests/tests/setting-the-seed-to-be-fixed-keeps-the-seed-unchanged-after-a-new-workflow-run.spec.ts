import { mergeTests } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'

const wstest = mergeTests(test, webSocketFixture)

wstest.describe('Fixed seed', { tag: ['@widget', '@vue-nodes'] }, () => {
  wstest.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('default')
  })

  wstest(
    'setting the seed to be fixed keeps the seed unchanged after a new workflow run',
    async ({ comfyPage, getWebSocket }) => {
      const execution = new ExecutionHelper(comfyPage, await getWebSocket())
      const seedWidget = comfyPage.vueNodes.getWidgetByName('', 'seed')
      const { input, valueControl } =
        comfyPage.vueNodes.getInputNumberControls(seedWidget)

      await input.fill('1')
      await valueControl.click()
      await comfyPage.page.getByRole('radio', { name: 'fixed' }).click()
      await comfyPage.keyboard.press('Escape')

      await execution.run()

      await expect(input).toHaveValue('1')
    }
  )
})
