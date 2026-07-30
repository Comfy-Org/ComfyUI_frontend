import { useBillingContext } from '@/composables/billing/useBillingContext'
import { t } from '@/i18n'
import { prepareChurnkey } from '@/platform/cloud/churnkey/churnkeyClient'
import { useTelemetry } from '@/platform/telemetry'
import type { SubscriptionCancellationMetadata } from '@/platform/telemetry/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { getErrorMessage } from '@/utils/errorUtil'

interface LaunchCancellationFlowOptions {
  showFallback: () => void | Promise<unknown>
}

export async function launchCancellationFlow({
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

  const session = await prepareChurnkey().catch(() => null)
  if (!session) {
    if (isLaunchWorkspaceCurrent()) await showFallback()
    return
  }
  if (!isLaunchWorkspaceCurrent()) return

  const telemetry = useTelemetry()
  const metadata: SubscriptionCancellationMetadata = {
    source: 'cancel_plan_menu',
    current_tier: billing.tier.value?.toLowerCase()
  }

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
    await showFallback()
  }
}
