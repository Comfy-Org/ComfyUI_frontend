import { useBillingContext } from '@/composables/billing/useBillingContext'
import { t } from '@/i18n'
import { prepareChurnkey } from '@/platform/cloud/churnkey/churnkeyClient'
import { getSubscriptionCancellationMetadata } from '@/platform/cloud/subscription/utils/subscriptionCancellationTelemetry'
import { useTelemetry } from '@/platform/telemetry'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { getErrorMessage } from '@/utils/errorUtil'

interface CancellationFallbackOptions {
  flowAlreadyOpened?: boolean
}

interface LaunchCancellationFlowOptions {
  cancelAt?: string
  showFallback: (
    options?: CancellationFallbackOptions
  ) => void | Promise<unknown>
}

export async function launchCancellationFlow({
  cancelAt,
  showFallback
}: LaunchCancellationFlowOptions): Promise<void> {
  const billing = useBillingContext()
  const workspaceStore = useTeamWorkspaceStore()
  const launchWorkspaceId = workspaceStore.activeWorkspaceId
  if (
    billing.type.value !== 'workspace' ||
    !launchWorkspaceId ||
    workspaceStore.activeWorkspaceBillingRail !== 'stripe'
  ) {
    await showFallback()
    return
  }

  function isLaunchWorkspaceCurrent() {
    return workspaceStore.activeWorkspaceId === launchWorkspaceId
  }

  const session = await prepareChurnkey().catch((error) => {
    console.warn('Failed to prepare Churnkey cancellation flow:', error)
    return null
  })
  if (!session) {
    if (isLaunchWorkspaceCurrent()) await showFallback()
    return
  }
  if (!isLaunchWorkspaceCurrent()) return

  const telemetry = useTelemetry()
  const metadata = getSubscriptionCancellationMetadata({
    cancelAt,
    duration: billing.subscription.value?.duration,
    endDate: billing.subscription.value?.endDate,
    tier: billing.tier.value
  })

  telemetry?.trackSubscriptionCancellation('flow_opened', metadata)

  try {
    const results = await session.show({
      handleCancel: async () => {
        if (!isLaunchWorkspaceCurrent()) {
          throw new Error(t('subscription.cancelDialog.workspaceChanged'))
        }
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
    if (!isLaunchWorkspaceCurrent()) return
    telemetry?.trackSubscriptionCancellation('failed', {
      ...metadata,
      error_message: getErrorMessage(error) ?? t('g.unknownError')
    })
    await showFallback({ flowAlreadyOpened: true })
  }
}
