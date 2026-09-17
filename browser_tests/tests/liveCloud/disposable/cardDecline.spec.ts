import { declineCheckout } from '@e2e/tests/liveCloud/helpers/checkoutScenarios'
import {
  expect,
  liveCloudDisposableBillingFixture as test
} from '@e2e/fixtures/liveCloudDisposableBillingFixture'

test.describe('Real Cloud checkout failure', { tag: ['@cloud-live'] }, () => {
  test('keeps the account on Free after a card decline', async ({
    disposableCheckout
  }, testInfo) => {
    const failure = await declineCheckout(
      disposableCheckout.checkout,
      disposableCheckout.billingSession,
      testInfo
    )
    expect(failure).toMatchObject({
      status: 'failed',
      failureKind: 'card_declined_ui'
    })
  })
})
