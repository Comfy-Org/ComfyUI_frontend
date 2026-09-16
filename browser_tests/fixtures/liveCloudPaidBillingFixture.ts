import { LiveCloudTopup } from '@e2e/fixtures/helpers/LiveCloudTopup'
import { liveCloudBillingFixture } from '@e2e/fixtures/liveCloudBillingFixture'
import { loadLiveCloudBillingConfig } from '@e2e/fixtures/utils/liveCloudBillingConfig'

export const liveCloudPaidBillingFixture = liveCloudBillingFixture.extend<{
  topup: LiveCloudTopup
}>({
  liveCloudBillingConfig: async ({ liveCloudBillingConfig }, use) => {
    if (!liveCloudBillingConfig) throw new Error('Live billing config required')
    if (
      liveCloudBillingConfig.PLAYWRIGHT_SETUP_API_URL ===
      'https://cloud.comfy.org'
    )
      throw new Error('Paid billing tests require a Cloud sandbox')
    await use({ ...liveCloudBillingConfig, allowPayments: true })
  },
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
