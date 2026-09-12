import {
  expect,
  liveCloudDisposableBillingFixture as test
} from '@e2e/fixtures/liveCloudDisposableBillingFixture'

test.describe('Real Cloud 3D Secure', { tag: ['@cloud-live'] }, () => {
  test.setTimeout(180_000)

  test('keeps the account on Free after failed authentication', async ({
    disposableCheckout
  }, testInfo) => {
    const failure = await disposableCheckout.checkout.failAuthenticatedCheckout(
      disposableCheckout.billingSession,
      testInfo
    )
    expect(failure).toMatchObject({
      authenticationState: 'failed_retryable'
    })
  })
})
