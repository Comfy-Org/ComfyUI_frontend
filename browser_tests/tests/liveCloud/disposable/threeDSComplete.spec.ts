import {
  expect,
  liveCloudDisposableBillingFixture as test
} from '@e2e/fixtures/liveCloudDisposableBillingFixture'

test.describe('Real Cloud 3D Secure', { tag: ['@cloud-live'] }, () => {
  test.setTimeout(180_000)

  test('activates Creator after successful authentication', async ({
    disposableCheckout
  }, testInfo) => {
    const completion =
      await disposableCheckout.checkout.completeAuthenticatedCheckout(
        disposableCheckout.billingSession,
        testInfo
      )
    expect(completion).toMatchObject({
      planSlug: 'creator-monthly',
      paymentMethodCount: 1
    })
  })
})
