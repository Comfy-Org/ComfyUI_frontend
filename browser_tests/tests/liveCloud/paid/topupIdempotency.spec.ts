import { liveCloudPaidBillingFixture as test } from '@e2e/fixtures/liveCloudPaidBillingFixture'

test.describe('Real Cloud saved-card billing', { tag: ['@cloud-live'] }, () => {
  test('retries one top-up without granting credits twice', async ({
    topup
  }, testInfo) => {
    await topup.verifyIdempotentRetry(testInfo)
  })
})
