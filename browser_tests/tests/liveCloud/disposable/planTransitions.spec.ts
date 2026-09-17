import { verifyPlanTransitions } from '@e2e/tests/liveCloud/helpers/lifecycleScenarios'
import {
  expect,
  liveCloudDisposableBillingFixture as test
} from '@e2e/fixtures/liveCloudDisposableBillingFixture'

test.describe('Real Cloud plan transitions', { tag: ['@cloud-live'] }, () => {
  test.setTimeout(240_000)

  test('upgrades now and schedules a downgrade', async ({
    disposableCheckout
  }, testInfo) => {
    const completion = await disposableCheckout.checkout.completeCheckout(
      disposableCheckout.billingSession,
      testInfo
    )
    expect(completion.paymentMethodCount).toBe(1)
    const transitions = await verifyPlanTransitions(
      disposableCheckout.billingSession,
      testInfo
    )
    expect(transitions.scheduledPlan).toBe('standard-monthly')
  })
})
