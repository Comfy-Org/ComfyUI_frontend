import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { FreeTierQuota } from '@e2e/fixtures/components/FreeTierQuota'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'

const wstest = mergeTests(test, webSocketFixture)

test.describe('Free Tier Quota', { tag: ['@cloud', '@vue-nodes'] }, () => {
  test.beforeEach(async ({ page }) => {
    const features = {
      free_tier_job_allowance_enabled: true,
      free_tier_balance: { allowance: 5, remaining: 3, used: 0 }
    }
    await page.route('**/api/features', (r) => r.fulfill(jsonRoute(features)))
  })

  wstest('Free Tier Quota', async ({ comfyPage, getWebSocket }) => {
    const execution = new ExecutionHelper(comfyPage, await getWebSocket())
    const freeTierQuota = new FreeTierQuota(comfyPage)

    await test.step('Populates initial state from config', async () => {
      await expect.poll(() => freeTierQuota.getAvailable()).toBe('3')
      expect(await freeTierQuota.getMax()).toBe('5')
    })

    await test.step('available decrements on run', async () => {
      await execution.run()
      await expect.poll(() => freeTierQuota.getAvailable()).toBe('2')
    })

    await test.step('Detects workflows with Partner nodes', async () => {
      await comfyPage.searchBoxV2.addNode('Node With Price Badge')
      const node = await comfyPage.vueNodes.getFixtureByTitle('Price Badge')
      await expect.poll(() => freeTierQuota.getAvailable()).toBe(undefined)
      await node.delete()
      await expect.poll(() => freeTierQuota.getAvailable()).toBe('2')
    })

    await test.step('Does not decrease past 0', async () => {
      await execution.run()
      await expect.poll(() => freeTierQuota.getAvailable()).toBe('1')
      await execution.run()
      await expect.poll(() => freeTierQuota.getAvailable()).toBe(undefined)
      await execution.run()
      await execution.run()
      await execution.run()
      await comfyPage.nextFrame()
      expect(await freeTierQuota.getAvailable()).toBe(undefined)
    })
  })
})
