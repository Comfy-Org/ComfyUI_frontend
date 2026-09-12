import { LiveCloudTopup } from '@e2e/fixtures/helpers/LiveCloudTopup'
import { liveCloudBillingFixture } from '@e2e/fixtures/liveCloudBillingFixture'
import { loadLiveCloudBillingConfig } from '@e2e/fixtures/utils/liveCloudBillingConfig'

export const liveCloudPaidBillingFixture = liveCloudBillingFixture.extend<{
  topup: LiveCloudTopup
}>({
  topup: async ({ comfyPage, billingSession }, use) => {
    const topup = new LiveCloudTopup(
      comfyPage,
      billingSession,
      loadLiveCloudBillingConfig().PLAYWRIGHT_TEST_URL
    )
    await topup.open()
    await use(topup)
  }
})
