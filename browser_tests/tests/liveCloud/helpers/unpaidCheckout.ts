import { zBillingOpStatusResponse } from '@comfyorg/ingest-types/zod'
import { expect } from '@playwright/test'
import type { TestInfo } from '@playwright/test'
import type { LiveCloudBillingSession } from '@e2e/fixtures/helpers/LiveCloudBillingSession'
import type { LiveCloudCheckout } from '@e2e/fixtures/helpers/LiveCloudCheckout'
export async function abandonCheckout(
  driver: LiveCloudCheckout,
  testInfo: TestInfo
) {
  const { checkout, subscription } = await driver.startCheckout()
  await testInfo.attach('billing-operation.json', {
    body: JSON.stringify({
      operationId: subscription.billing_op_id,
      status: subscription.status
    }),
    contentType: 'application/json'
  })
  await testInfo.attach('stripe-checkout.png', {
    body: await checkout.screenshot(),
    contentType: 'image/png'
  })
  await checkout.close()
  return subscription.billing_op_id
}
export async function expectPending(
  session: LiveCloudBillingSession,
  operationId: string
) {
  await expect
    .poll(() =>
      session.read(
        `/api/billing/ops/${encodeURIComponent(operationId)}`,
        zBillingOpStatusResponse
      )
    )
    .toMatchObject({
      id: operationId,
      status: 'pending',
      phase: 'awaiting_payment_method'
    })
}
