import { useBillingContext } from '@/composables/billing/useBillingContext'
import { t } from '@/i18n'
import { prepareChurnkey } from '@/platform/cloud/churnkey/churnkeyClient'
import { useTelemetry } from '@/platform/telemetry'
import type { SubscriptionCancellationMetadata } from '@/platform/telemetry/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { getErrorMessage } from '@/utils/errorUtil'

interface LaunchCancellationFlowOptions {
  cancelAt?: string
  showFallback: () => void | Promise<unknown>
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

export async function launchCancellationFlow({
  cancelAt,
  showFallback
}: LaunchCancellationFlowOptions): Promise<void> {
  const billing = useBillingContext()
  const workspaceStore = useTeamWorkspaceStore()
  if (
    billing.type.value !== 'workspace' ||
    workspaceStore.activeWorkspaceBillingRail !== 'stripe'
  ) {
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

  telemetry?.trackSubscriptionCancellation('flow_opened', metadata)

  try {
    const results = await session.show({
      handleCancel: async () => {
        telemetry?.trackSubscriptionCancellation('confirmed', metadata)
        try {
          await billing.cancelSubscription()
          return { message: t('subscription.cancelSuccess') }
        } catch (error) {
          throw new Error(
            getErrorMessage(error) ?? t('subscription.cancelDialog.failed'),
            { cause: error }
          )
        }
      }
    })

    if (results.aborted === true) {
      telemetry?.trackSubscriptionCancellation('abandoned', metadata)
    }
  } catch (error) {
    telemetry?.trackSubscriptionCancellation('failed', {
      ...metadata,
      error_message: getErrorMessage(error) ?? t('g.unknownError')
    })
    await showFallback()
  }
}
