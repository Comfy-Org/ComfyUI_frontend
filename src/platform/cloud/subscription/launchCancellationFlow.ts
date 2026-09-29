import { useBillingContext } from '@/composables/billing/useBillingContext'
import { t } from '@/i18n'
import { prepareChurnkey } from '@/platform/cloud/churnkey/churnkeyClient'
import type { ChurnkeySession } from '@/platform/cloud/churnkey/churnkeyClient'
import { getSubscriptionCancellationMetadata } from '@/platform/cloud/subscription/utils/subscriptionCancellationTelemetry'
import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { getErrorMessage } from '@/utils/errorUtil'

interface CancellationFallbackOptions {
  flowAlreadyOpened?: boolean
  isScopeCurrent?: () => boolean
}

async function showCancellationFallback(
  showFallback: LaunchCancellationFlowOptions['showFallback'],
  isScopeCurrent: () => boolean,
  options?: CancellationFallbackOptions,
  vendorError?: unknown
): Promise<boolean> {
  if (!isScopeCurrent()) return false
  try {
    await showFallback({ ...options, isScopeCurrent })
    return true
  } catch (fallbackError) {
    const workspaceStillCurrent = isScopeCurrent()
    const reportedError =
      vendorError === undefined
        ? fallbackError
        : new AggregateError(
            [fallbackError, vendorError],
            'Cancellation vendor and fallback failed'
          )
    reportError(reportedError, {
      errorType: 'cloud_cancellation_vendor_fallback',
      tags: {
        failure_kind: workspaceStillCurrent ? 'caught_unexpected' : 'degraded',
        feature_area: 'billing',
        operation: 'load',
        outcome: workspaceStillCurrent ? 'failed' : 'aborted',
        vendor_preparation_failed: vendorError !== undefined,
        workspace_still_current: workspaceStillCurrent
      },
      level: workspaceStillCurrent ? 'error' : 'warning'
    })
    return false
  }
}

interface LaunchCancellationFlowOptions {
  cancelAt?: string
  showFallback: (
    options?: CancellationFallbackOptions
  ) => void | Promise<unknown>
}

async function prepareCancellationSession(
  isLaunchWorkspaceCurrent: () => boolean,
  showFallback: LaunchCancellationFlowOptions['showFallback']
): Promise<ChurnkeySession | null> {
  const preparation = await prepareChurnkey().then(
    (session) => ({ session, threw: false as const }),
    (error: unknown) => ({ session: null, threw: true as const, error })
  )
  if (preparation.session) return preparation.session

  if (!isLaunchWorkspaceCurrent()) {
    if (preparation.threw) {
      reportError(preparation.error, {
        errorType: 'cloud_cancellation_vendor_fallback',
        tags: {
          failure_kind: 'degraded',
          feature_area: 'billing',
          operation: 'load',
          outcome: 'aborted',
          workspace_still_current: false
        },
        level: 'warning'
      })
    }
    return null
  }

  const fallbackShown = await showCancellationFallback(
    showFallback,
    isLaunchWorkspaceCurrent,
    undefined,
    preparation.threw ? preparation.error : undefined
  )
  if (preparation.threw && fallbackShown) {
    const workspaceStillCurrent = isLaunchWorkspaceCurrent()
    reportError(preparation.error, {
      errorType: 'cloud_cancellation_vendor_fallback',
      tags: {
        failure_kind: 'degraded',
        feature_area: 'billing',
        operation: 'load',
        outcome: workspaceStillCurrent ? 'recovered' : 'aborted',
        workspace_still_current: workspaceStillCurrent
      },
      level: 'warning'
    })
  }
  return null
}

export async function launchCancellationFlow({
  cancelAt,
  showFallback
}: LaunchCancellationFlowOptions): Promise<void> {
  const billing = useBillingContext()
  const workspaceStore = useTeamWorkspaceStore()
  const launchWorkspaceId = workspaceStore.activeWorkspaceId
  const isLaunchWorkspaceCurrent = () =>
    workspaceStore.activeWorkspaceId === launchWorkspaceId
  if (
    billing.type.value !== 'workspace' ||
    !launchWorkspaceId ||
    workspaceStore.activeWorkspaceBillingRail !== 'stripe'
  ) {
    await showCancellationFallback(showFallback, isLaunchWorkspaceCurrent)
    return
  }

  const session = await prepareCancellationSession(
    isLaunchWorkspaceCurrent,
    showFallback
  )
  if (!session) return
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

    switch (results.type) {
      case 'discount-applied':
        if (!isLaunchWorkspaceCurrent()) return
        await billing.fetchStatus().catch((error) => {
          reportError(error, {
            errorType: 'error_refreshing_billing_after_churnkey_discount'
          })
          useToastStore().add({
            severity: 'warn',
            summary: t('subscription.cancelDialog.discountRefreshFailed'),
            life: 8000
          })
        })
        return
      case 'abandoned':
        telemetry?.trackSubscriptionCancellation('abandoned', metadata)
        return
      case 'closed':
        return
      default: {
        const unreachable: never = results
        return unreachable
      }
    }
  } catch (error) {
    if (!isLaunchWorkspaceCurrent()) return
    telemetry?.trackSubscriptionCancellation('failed', {
      ...metadata,
      error_message: getErrorMessage(error) ?? t('g.unknownError')
    })
    await showCancellationFallback(showFallback, isLaunchWorkspaceCurrent, {
      flowAlreadyOpened: true
    })
  }
}
