import type { LiveCloudBillingSession } from '@e2e/fixtures/helpers/LiveCloudBillingSession'
import { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'
import { signInToLiveCloud } from '@e2e/fixtures/utils/liveCloudBillingContext'
import { loadLiveCloudBillingConfig } from '@e2e/fixtures/utils/liveCloudBillingConfig'

export const liveCloudBillingFixture = base.extend<{
  comfyPage: ComfyPage
  billingSession: LiveCloudBillingSession
}>({
  baseURL: process.env.PLAYWRIGHT_TEST_URL,
  liveCloudBillingConfig: async ({ liveCloudBillingConfig }, use) => {
    await use(liveCloudBillingConfig ?? loadLiveCloudBillingConfig())
  },
  billingSession: async ({ page, liveCloudBillingConfig }, use) => {
    await use(await signInToLiveCloud(page, liveCloudBillingConfig))
  },
  comfyPage: async (
    { page, request, billingSession: _billingSession },
    use
  ) => {
    await use(new ComfyPage(page, request))
  }
})
