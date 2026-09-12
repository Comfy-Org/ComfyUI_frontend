import {
  expect,
  liveCloudDisposableBillingFixture as test
} from '@e2e/fixtures/liveCloudDisposableBillingFixture'

test.describe(
  'Real Cloud checkout completion',
  { tag: ['@cloud-live'] },
  () => {
    test('activates Creator and grants the quoted credits', async ({
      disposableCheckout
    }, testInfo) => {
      const completion = await disposableCheckout.checkout.completeCheckout(
        disposableCheckout.billingSession,
        testInfo
      )
      expect(completion).toMatchObject({
        planSlug: 'creator-monthly',
        paymentMethodCount: 1
      })
    })
  }
)
