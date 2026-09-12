import {
  expect,
  liveCloudDisposableBillingFixture as test
} from '@e2e/fixtures/liveCloudDisposableBillingFixture'

test.describe('Real Cloud checkout recovery', { tag: ['@cloud-live'] }, () => {
  test.setTimeout(240_000)

  test('completes checkout after a card decline', async ({
    disposableCheckout
  }, testInfo) => {
    await disposableCheckout.checkout.declineCheckout(
      disposableCheckout.billingSession,
      testInfo
    )
    const completion = await disposableCheckout.checkout.completeCheckout(
      disposableCheckout.billingSession,
      testInfo,
      2
    )
    expect(completion).toMatchObject({
      planSlug: 'creator-monthly',
      paymentMethodCount: 2
    })
  })
})
