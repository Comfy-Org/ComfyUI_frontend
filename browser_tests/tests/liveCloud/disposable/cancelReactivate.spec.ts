import {
  expect,
  liveCloudDisposableBillingFixture as test
} from '@e2e/fixtures/liveCloudDisposableBillingFixture'

test.describe(
  'Real Cloud subscription lifecycle',
  { tag: ['@cloud-live'] },
  () => {
    test.setTimeout(240_000)

    test('cancels and reactivates without changing the balance', async ({
      disposableCheckout
    }, testInfo) => {
      await disposableCheckout.checkout.completeCheckout(
        disposableCheckout.billingSession,
        testInfo
      )
      const recovery =
        await disposableCheckout.checkout.verifyCancellationRecovery(
          disposableCheckout.billingSession,
          testInfo
        )
      expect(recovery.balanceAfterCents).toBe(recovery.balanceBeforeCents)
    })
  }
)
