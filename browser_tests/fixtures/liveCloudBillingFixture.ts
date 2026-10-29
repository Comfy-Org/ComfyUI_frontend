import { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'
import { loadLiveCloudBillingConfig } from '@e2e/fixtures/utils/liveCloudBillingConfig'
import { signInToLiveCloud } from '@e2e/fixtures/utils/liveCloudBillingContext'

export const liveCloudBillingFixture = base.extend<{
  comfyPage: ComfyPage
}>({
  baseURL: process.env.PLAYWRIGHT_TEST_URL,
  liveCloudBillingConfig: async ({ liveCloudBillingConfig }, use) => {
    await use(liveCloudBillingConfig ?? loadLiveCloudBillingConfig())
  },
  comfyPage: async ({ page, request }, use) => {
    await signInToLiveCloud(page)
    await use(new ComfyPage(page, request))
  }
})
