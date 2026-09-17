import { LiveCloudTopup } from '@e2e/fixtures/helpers/LiveCloudTopup'
import { liveCloudDisposableBillingFixture } from '@e2e/fixtures/liveCloudDisposableBillingFixture'

export const liveCloudPaidBillingFixture =
  liveCloudDisposableBillingFixture.extend<{
    topup: LiveCloudTopup
  }>({
    topup: async (
      { comfyPage, disposableCheckout, liveCloudBillingConfig },
      use,
      testInfo
    ) => {
      if (!liveCloudBillingConfig)
        throw new Error('Live billing config required')
      await disposableCheckout.checkout.completeCheckout(
        disposableCheckout.billingSession,
        testInfo
      )
      const topup = new LiveCloudTopup(
        comfyPage,
        disposableCheckout.billingSession,
        liveCloudBillingConfig.PLAYWRIGHT_TEST_URL
      )
      await topup.open()
      await use(topup)
    }
  })
