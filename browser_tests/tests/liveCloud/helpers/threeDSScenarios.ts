import {
  zBillingBalanceResponse,
  zBillingStatusResponse,
  zBillingOpStatusResponse
} from '@comfyorg/ingest-types/zod'
import { expect } from '@playwright/test'
import type { Page, TestInfo } from '@playwright/test'

import type { LiveCloudBillingSession } from '@e2e/fixtures/helpers/LiveCloudBillingSession'
import type { LiveCloudCheckout } from '@e2e/fixtures/helpers/LiveCloudCheckout'

async function answerChallenge(
  page: Page,
  answer: 'Complete' | 'Fail',
  testInfo: TestInfo,
  screenshotName: string
) {
  const frames = () =>
    page
      .frames()
      .find((frame) =>
        frame.url().startsWith('https://testmode-acs.stripe.com')
      )
  await expect.poll(() => Boolean(frames())).toBe(true)
  const frame = frames()
  if (!frame) throw new Error('3D Secure challenge did not load')
  await frame.waitForLoadState('load')
  const action = frame.getByRole('button', { name: answer, exact: true })
  await expect(action).toBeVisible()
  await testInfo.attach(screenshotName, {
    body: await page.screenshot(),
    contentType: 'image/png'
  })
  await action.press('Enter')
}

async function authenticateInvoice(
  driver: LiveCloudCheckout,
  session: LiveCloudBillingSession,
  testInfo: TestInfo,
  answer: 'Complete' | 'Fail'
) {
  const balanceBefore = await session.read(
    '/api/billing/balance',
    zBillingBalanceResponse
  )
  const preview = await driver.open(true)
  const { checkout, subscription } = await driver.startCheckout()
  await driver.submitCard(checkout, '4000000000003220')
  await answerChallenge(checkout, 'Complete', testInfo, '3ds-card-setup.png')
  await expect
    .poll(
      async () =>
        (
          await session.read(
            `/api/billing/ops/${encodeURIComponent(subscription.billing_op_id)}`,
            zBillingOpStatusResponse
          )
        ).authentication_state,
      { timeout: 60_000 }
    )
    .toBe('requires_action')
  const verification = driver.page.getByRole('button', {
    name: 'Complete verification',
    exact: true
  })
  await expect(verification).toBeVisible({ timeout: 60_000 })
  const [invoice] = await Promise.all([
    driver.page.context().waitForEvent('page'),
    verification.click()
  ])
  await invoice
    .getByRole('button', { name: 'Confirm payment', exact: true })
    .click()
  await answerChallenge(
    invoice,
    answer,
    testInfo,
    `3ds-invoice-${answer.toLowerCase()}.png`
  )
  return { balanceBefore, preview, operationId: subscription.billing_op_id }
}

export async function completeAuthenticatedCheckout(
  driver: LiveCloudCheckout,
  session: LiveCloudBillingSession,
  testInfo: TestInfo
) {
  const { balanceBefore, preview, operationId } = await authenticateInvoice(
    driver,
    session,
    testInfo,
    'Complete'
  )
  return await driver.verifyCheckoutCompletion(
    session,
    testInfo,
    balanceBefore.amount_micros,
    preview,
    operationId,
    '3ds-completed.png'
  )
}

export async function failAuthenticatedCheckout(
  driver: LiveCloudCheckout,
  session: LiveCloudBillingSession,
  testInfo: TestInfo
) {
  const { balanceBefore, operationId } = await authenticateInvoice(
    driver,
    session,
    testInfo,
    'Fail'
  )
  await expect
    .poll(
      async () => {
        const operation = await session.read(
          `/api/billing/ops/${encodeURIComponent(operationId)}`,
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
      status: 'pending',
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
      operationId,
      balanceBeforeCents: balanceBefore.amount_micros,
      balanceAfterCents: balanceAfter.amount_micros,
      authenticationState: 'failed_retryable'
    }),
    contentType: 'application/json'
  })
  return { authenticationState: 'failed_retryable' }
}
