import {
  zBillingBalanceResponse,
  zBillingStatusResponse,
  zBillingOpStatusResponse,
  zCancelSubscriptionAcceptedResponse,
  zCancelSubscriptionResponse,
  zResubscribeResponse,
  zPreviewSubscribeResponse,
  zSubscribeResponse
} from '@comfyorg/ingest-types/zod'
import { z } from 'zod'
import { expect } from '@playwright/test'
import type { TestInfo } from '@playwright/test'
import type { LiveCloudBillingSession } from '@e2e/fixtures/helpers/LiveCloudBillingSession'
async function expectSucceeded(
  session: LiveCloudBillingSession,
  operationId: string
) {
  await expect
    .poll(
      async () => {
        const operation = await session.read(
          `/api/billing/ops/${encodeURIComponent(operationId)}`,
          zBillingOpStatusResponse
        )
        return operation.status
      },
      { timeout: 60_000 }
    )
    .toBe('succeeded')
}
export async function verifyCancellationRecovery(
  session: LiveCloudBillingSession,
  testInfo: TestInfo
) {
  const balanceBefore = await session.read(
    '/api/billing/balance',
    zBillingBalanceResponse
  )
  const cancel = await session.post(
    '/api/billing/subscription/cancel',
    { idempotency_key: crypto.randomUUID() },
    z.union([zCancelSubscriptionResponse, zCancelSubscriptionAcceptedResponse]),
    [200, 202]
  )
  await expectSucceeded(session, cancel.billing_op_id)
  await expect
    .poll(() => session.read('/api/billing/status', zBillingStatusResponse))
    .toMatchObject({
      plan_slug: 'creator-monthly',
      subscription_tier: 'CREATOR'
    })
  const canceled = await session.read(
    '/api/billing/status',
    zBillingStatusResponse
  )
  expect(canceled.cancel_at).toBeTruthy()
  const resubscribe = await session.post(
    '/api/billing/subscription/resubscribe',
    { idempotency_key: crypto.randomUUID() },
    zResubscribeResponse
  )
  if (resubscribe.status === 'pending') {
    await expectSucceeded(session, resubscribe.billing_op_id)
  }
  await expect
    .poll(async () => {
      const status = await session.read(
        '/api/billing/status',
        zBillingStatusResponse
      )
      return {
        cancelAt: status.cancel_at,
        planSlug: status.plan_slug,
        subscriptionStatus: status.subscription_status
      }
    })
    .toMatchObject({
      cancelAt: undefined,
      planSlug: 'creator-monthly',
      subscriptionStatus: 'active'
    })
  const balanceAfter = await session.read(
    '/api/billing/balance',
    zBillingBalanceResponse
  )
  expect(balanceAfter.amount_micros).toBe(balanceBefore.amount_micros)
  const result = {
    cancelOperationId: cancel.billing_op_id,
    reactivateOperationId: resubscribe.billing_op_id,
    balanceBeforeCents: balanceBefore.amount_micros,
    balanceAfterCents: balanceAfter.amount_micros
  }
  await testInfo.attach('cancellation-recovery.json', {
    body: JSON.stringify(result),
    contentType: 'application/json'
  })
  return result
}
export async function verifyPlanTransitions(
  session: LiveCloudBillingSession,
  testInfo: TestInfo
) {
  const balanceBeforeUpgrade = await session.read(
    '/api/billing/balance',
    zBillingBalanceResponse
  )
  const upgradePreview = await session.post(
    '/api/billing/preview-subscribe',
    { plan_slug: 'pro-monthly' },
    zPreviewSubscribeResponse
  )
  expect(upgradePreview).toMatchObject({
    allowed: true,
    transition_type: 'upgrade'
  })
  const upgradeRequest: Record<string, number | string> = {
    plan_slug: 'pro-monthly'
  }
  if (upgradePreview.quote_id) {
    upgradeRequest.quote_id = upgradePreview.quote_id
  }
  if (upgradePreview.quote_version !== undefined) {
    upgradeRequest.quote_version = upgradePreview.quote_version
  }
  if (upgradePreview.proration_at) {
    upgradeRequest.proration_at = upgradePreview.proration_at
  }
  const upgrade = await session.post(
    '/api/billing/subscribe',
    upgradeRequest,
    zSubscribeResponse
  )
  await expectSucceeded(session, upgrade.billing_op_id)
  await expect
    .poll(() => session.read('/api/billing/status', zBillingStatusResponse))
    .toMatchObject({
      plan_slug: 'pro-monthly',
      subscription_tier: 'PRO'
    })
  const expectedUpgradeBalance =
    balanceBeforeUpgrade.amount_micros +
    Number(upgradePreview.credits_today_cents)
  await expect
    .poll(
      async () =>
        (await session.read('/api/billing/balance', zBillingBalanceResponse))
          .amount_micros
    )
    .toBe(expectedUpgradeBalance)
  const downgradePreview = await session.post(
    '/api/billing/preview-subscribe',
    { plan_slug: 'standard-monthly' },
    zPreviewSubscribeResponse
  )
  expect(downgradePreview).toMatchObject({
    allowed: true,
    transition_type: 'downgrade'
  })
  const downgradeRequest: Record<string, number | string> = {
    plan_slug: 'standard-monthly'
  }
  if (downgradePreview.quote_id) {
    downgradeRequest.quote_id = downgradePreview.quote_id
  }
  if (downgradePreview.quote_version !== undefined) {
    downgradeRequest.quote_version = downgradePreview.quote_version
  }
  if (downgradePreview.proration_at) {
    downgradeRequest.proration_at = downgradePreview.proration_at
  }
  const downgrade = await session.post(
    '/api/billing/subscribe',
    downgradeRequest,
    zSubscribeResponse
  )
  await expectSucceeded(session, downgrade.billing_op_id)
  await expect
    .poll(() => session.read('/api/billing/status', zBillingStatusResponse))
    .toMatchObject({
      plan_slug: 'pro-monthly',
      scheduled_change: { plan_slug: 'standard-monthly' }
    })
  const balanceAfterDowngrade = await session.read(
    '/api/billing/balance',
    zBillingBalanceResponse
  )
  expect(balanceAfterDowngrade.amount_micros).toBe(expectedUpgradeBalance)
  const result = {
    upgradeOperationId: upgrade.billing_op_id,
    downgradeOperationId: downgrade.billing_op_id,
    balanceBeforeUpgradeCents: balanceBeforeUpgrade.amount_micros,
    balanceAfterDowngradeCents: balanceAfterDowngrade.amount_micros,
    scheduledPlan: 'standard-monthly'
  }
  await testInfo.attach('plan-transitions.json', {
    body: JSON.stringify(result),
    contentType: 'application/json'
  })
  return result
}
