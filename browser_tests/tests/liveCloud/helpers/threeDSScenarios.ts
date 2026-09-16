import {
  zBillingBalanceResponse,
  zBillingStatusResponse,
  zBillingOpStatusResponse
} from '@comfyorg/ingest-types/zod'
import { expect } from '@playwright/test'
import type { TestInfo } from '@playwright/test'
import type { LiveCloudBillingSession } from '@e2e/fixtures/helpers/LiveCloudBillingSession'
import type { LiveCloudCheckout } from '@e2e/fixtures/helpers/LiveCloudCheckout'
export async function completeAuthenticatedCheckout(
  driver: LiveCloudCheckout,
  session: LiveCloudBillingSession,
  testInfo: TestInfo
) {
  const balanceBefore = await session.read(
    '/api/billing/balance',
    zBillingBalanceResponse
  )
  const preview = await driver.open(true)
  const { checkout, subscription } = await driver.startCheckout()
  await driver.submitCard(checkout, '4000000000003220')
  const challengeOrigin = 'https://testmode-acs.stripe.com'
  await expect
    .poll(() =>
      checkout.frames().some((frame) => frame.url().startsWith(challengeOrigin))
    )
    .toBe(true)
  const challenge = checkout
    .frames()
    .find((frame) => frame.url().startsWith(challengeOrigin))
  if (!challenge) throw new Error('3D Secure challenge did not load')
  const completeAuthentication = challenge.getByRole('button', {
    name: /complete/i
  })
  await expect(completeAuthentication).toBeVisible()
  await testInfo.attach('3ds-challenge.png', {
    body: await checkout.screenshot(),
    contentType: 'image/png'
  })
  await completeAuthentication.click()
  return await driver.verifyCheckoutCompletion(
    session,
    testInfo,
    balanceBefore.amount_micros,
    preview,
    subscription.billing_op_id,
    '3ds-completed.png'
  )
}
export async function failAuthenticatedCheckout(
  driver: LiveCloudCheckout,
  session: LiveCloudBillingSession,
  testInfo: TestInfo
) {
  const balanceBefore = await session.read(
    '/api/billing/balance',
    zBillingBalanceResponse
  )
  await driver.open(true)
  const { checkout, subscription } = await driver.startCheckout()
  await driver.submitCard(checkout, '4000000000003220')
  const challengeOrigin = 'https://testmode-acs.stripe.com'
  await expect
    .poll(() =>
      checkout.frames().some((frame) => frame.url().startsWith(challengeOrigin))
    )
    .toBe(true)
  const challenge = checkout
    .frames()
    .find((frame) => frame.url().startsWith(challengeOrigin))
  if (!challenge) throw new Error('3D Secure challenge did not load')
  const failAuthentication = challenge.getByRole('button', { name: /fail/i })
  await expect(failAuthentication).toBeVisible()
  await testInfo.attach('3ds-failure-challenge.png', {
    body: await checkout.screenshot(),
    contentType: 'image/png'
  })
  await failAuthentication.click()
  await expect
    .poll(
      async () => {
        const operation = await session.read(
          `/api/billing/ops/${encodeURIComponent(subscription.billing_op_id)}`,
          zBillingOpStatusResponse
        )
        return {
          status: operation.status,
          authenticationState: operation.authentication_state,
          declineReason: operation.decline_reason
        }
      },
      { timeout: 60_000 }
    )
    .toMatchObject({
      status: 'failed',
      authenticationState: 'failed_retryable'
    })
  const status = await session.read(
    '/api/billing/status',
    zBillingStatusResponse
  )
  expect(status.subscription_tier).toBe('FREE')
  const balanceAfter = await session.read(
    '/api/billing/balance',
    zBillingBalanceResponse
  )
  expect(balanceAfter.amount_micros).toBe(balanceBefore.amount_micros)
  await testInfo.attach('3ds-failure.json', {
    body: JSON.stringify({
      operationId: subscription.billing_op_id,
      balanceBeforeCents: balanceBefore.amount_micros,
      balanceAfterCents: balanceAfter.amount_micros,
      authenticationState: 'failed_retryable'
    }),
    contentType: 'application/json'
  })
  return { authenticationState: 'failed_retryable' }
}
