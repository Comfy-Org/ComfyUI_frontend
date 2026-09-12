import { liveCloudPaidBillingFixture as test } from '@e2e/fixtures/liveCloudPaidBillingFixture'

test.describe('Real Cloud saved-card billing', { tag: ['@cloud-live'] }, () => {
  test('purchases credits with the saved test card', async ({
    topup
  }, testInfo) => {
    await topup.verifyPurchase(testInfo)
  })
})
