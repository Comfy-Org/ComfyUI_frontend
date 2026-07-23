import { useBillingContext } from '@/composables/billing/useBillingContext'
import { t } from '@/i18n'
import { prepareChurnkey } from '@/platform/cloud/churnkey/churnkeyClient'
import { useTelemetry } from '@/platform/telemetry'
import type { SubscriptionCancellationMetadata } from '@/platform/telemetry/types'
import { getErrorMessage } from '@/utils/errorUtil'

interface LaunchCancellationFlowOptions {
  cancelAt?: string
  showFallback: () => unknown | Promise<unknown>
}

function cancellationMetadata(
  billing: ReturnType<typeof useBillingContext>,
  cancelAt?: string
): SubscriptionCancellationMetadata {
  const subscription = billing.subscription.value
  const endDate = cancelAt ?? subscription?.endDate
  return {
    source: 'cancel_plan_menu',
    current_tier: billing.tier.value?.toLowerCase(),
    ...(subscription?.duration
      ? {
          cycle:
            subscription.duration === 'ANNUAL'
              ? ('yearly' as const)
              : ('monthly' as const)
        }
      : {}),
    ...(endDate ? { end_date: endDate } : {})
  }
}

function customerAttributes(
  billing: ReturnType<typeof useBillingContext>
): Record<string, string> | undefined {
  const subscription = billing.subscription.value
  if (!subscription) return undefined

  const attributes = {
    ...(subscription.tier ? { tier: subscription.tier } : {}),
    ...(subscription.duration ? { cycle: subscription.duration } : {}),
    ...(subscription.planSlug ? { plan_slug: subscription.planSlug } : {})
  }
  return Object.keys(attributes).length > 0 ? attributes : undefined
}

let inFlight = false

export async function launchCancellationFlow({
  cancelAt,
  showFallback
}: LaunchCancellationFlowOptions): Promise<void> {
  if (inFlight) return
  inFlight = true
  try {
    await runCancellationFlow(cancelAt, showFallback)
  } finally {
    inFlight = false
  }
}

async function runCancellationFlow(
  cancelAt: string | undefined,
  showFallback: () => unknown | Promise<unknown>
): Promise<void> {
  const billing = useBillingContext()
  if (billing.type.value !== 'workspace') {
    await showFallback()
    return
  }

  const session = await prepareChurnkey().catch(() => null)
  if (!session) {
    await showFallback()
    return
  }

  const telemetry = useTelemetry()
  const metadata = cancellationMetadata(billing, cancelAt)
  let didCancelSucceed = false
  let cancelError: unknown

  telemetry?.trackSubscriptionCancellation('flow_opened', metadata)

  try {
    const results = await session.show({
      customerAttributes: customerAttributes(billing),
      handleCancel: async () => {
        telemetry?.trackSubscriptionCancellation('confirmed', metadata)
        try {
          await billing.cancelSubscription()
          didCancelSucceed = true
          await billing.fetchStatus().catch(() => undefined)
          return { message: t('subscription.cancelSuccess') }
        } catch (error) {
          cancelError = error
          throw new Error(
            getErrorMessage(error) ?? t('subscription.cancelDialog.failed'),
            { cause: error }
          )
        }
      }
    })

    if (!didCancelSucceed && results.status === 'closed') {
      telemetry?.trackSubscriptionCancellation('abandoned', metadata)
    }
  } catch (error) {
    if (didCancelSucceed) return
    telemetry?.trackSubscriptionCancellation('failed', {
      ...metadata,
      error_message:
        getErrorMessage(cancelError ?? error) ?? t('g.unknownError')
    })
    await showFallback()
  }
}
