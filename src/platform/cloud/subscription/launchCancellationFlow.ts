import { supportsInAppCancellation } from '@/composables/billing/billingRail'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import { prepareChurnkey } from '@/platform/cloud/churnkey/churnkeyClient'
import type { ChurnkeySession } from '@/platform/cloud/churnkey/churnkeyClient'
import {
  createCancelFlowReporter,
  getSubscriptionCancellationMetadata
} from '@/platform/cloud/subscription/utils/subscriptionCancellationTelemetry'
import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { CancellationScopeChangedError } from '@/platform/workspace/composables/useWorkspaceBilling'
import type { DialogInstance } from '@/stores/dialogStore'
import { getErrorMessage, toError } from '@/utils/errorUtil'

interface CancellationFallbackOptions {
  flowAlreadyOpened?: boolean
  flowAlreadyConfirmed?: boolean
  isScopeCurrent?: () => boolean
}

type VendorFailure = {
  stage: 'preparation' | 'session'
  error: unknown
}

function fallbackReportedError(
  fallbackError: unknown,
  vendorFailure: VendorFailure | undefined
): Error {
  const fallback = toError(fallbackError)
  if (!vendorFailure) return fallback

  const reported = new Error(fallback.message, {
    cause: toError(vendorFailure.error)
  })
  reported.name = fallback.name
  reported.stack = fallback.stack
  return reported
}

function reportFallbackFailure(
  fallbackError: unknown,
  vendorFailure: VendorFailure | undefined,
  workspaceStillCurrent: boolean
): void {
  reportError(fallbackReportedError(fallbackError, vendorFailure), {
    surface: 'billing',
    errorType: 'cloud_cancellation_vendor_fallback',
    tags: {
      failure_kind: workspaceStillCurrent ? 'caught_unexpected' : 'degraded',
      feature_area: 'billing',
      operation: 'load',
      outcome: workspaceStillCurrent ? 'failed' : 'aborted',
      vendor_stage: vendorFailure?.stage ?? 'none',
      vendor_preparation_failed: vendorFailure?.stage === 'preparation',
      workspace_still_current: workspaceStillCurrent
    },
    level: workspaceStillCurrent ? 'error' : 'warning'
  })
  if (!workspaceStillCurrent) return
  useToast().error(t('subscription.cancelDialog.failed'), {
    duration: 8000
  })
}

async function showCancellationFallback(
  showFallback: LaunchCancellationFlowOptions['showFallback'],
  isScopeCurrent: () => boolean,
  options?: CancellationFallbackOptions,
  vendorFailure?: VendorFailure
): Promise<'shown' | 'declined' | 'failed'> {
  if (!isScopeCurrent()) return 'declined'
  try {
    const opened = await showFallback({ ...options, isScopeCurrent })
    return opened ? 'shown' : 'declined'
  } catch (fallbackError) {
    const workspaceStillCurrent = isScopeCurrent()
    reportFallbackFailure(fallbackError, vendorFailure, workspaceStillCurrent)
    return 'failed'
  }
}

interface LaunchCancellationFlowOptions {
  cancelAt?: string
  launchWorkspaceId?: string | null
  showFallback: (
    options?: CancellationFallbackOptions
  ) => boolean | DialogInstance | Promise<boolean | DialogInstance>
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
        surface: 'billing',
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

  const fallbackOutcome = await showCancellationFallback(
    showFallback,
    isLaunchWorkspaceCurrent,
    undefined,
    preparation.threw
      ? { stage: 'preparation', error: preparation.error }
      : undefined
  )
  if (preparation.threw && fallbackOutcome !== 'failed') {
    const workspaceStillCurrent = isLaunchWorkspaceCurrent()
    reportError(preparation.error, {
      surface: 'billing',
      errorType: 'cloud_cancellation_vendor_fallback',
      tags: {
        failure_kind: 'degraded',
        feature_area: 'billing',
        operation: 'load',
        outcome:
          fallbackOutcome === 'shown' && workspaceStillCurrent
            ? 'recovered'
            : 'aborted',
        workspace_still_current: workspaceStillCurrent
      },
      level: 'warning'
    })
  }
  return null
}

async function fallBackAfterSessionFailure(
  error: unknown,
  showFallback: LaunchCancellationFlowOptions['showFallback'],
  isScopeCurrent: () => boolean,
  cancelReport: ReturnType<typeof createCancelFlowReporter>
): Promise<void> {
  cancelReport.sessionFailed()
  const fallback = await showCancellationFallback(
    showFallback,
    isScopeCurrent,
    {
      flowAlreadyOpened: true,
      flowAlreadyConfirmed: cancelReport.hasConfirmed()
    },
    { stage: 'session', error }
  )
  if (fallback === 'failed') cancelReport.failed('rendering')
}

export async function launchCancellationFlow({
  cancelAt,
  launchWorkspaceId: capturedWorkspaceId,
  showFallback
}: LaunchCancellationFlowOptions): Promise<void> {
  const billing = useBillingContext()
  const workspaceStore = useTeamWorkspaceStore()
  const launchWorkspaceId =
    capturedWorkspaceId === undefined
      ? workspaceStore.activeWorkspaceId
      : capturedWorkspaceId
  const isLaunchWorkspaceCurrent = () =>
    workspaceStore.activeWorkspaceId === launchWorkspaceId
  if (
    billing.type.value !== 'workspace' ||
    !launchWorkspaceId ||
    !supportsInAppCancellation(workspaceStore.activeWorkspaceBillingRail)
  ) {
    await showCancellationFallback(
      showFallback,
      launchWorkspaceId ? isLaunchWorkspaceCurrent : () => true
    )
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

  const plan = {
    duration: billing.subscription.value?.duration,
    tier: billing.tier.value
  }
  const cancelReport = createCancelFlowReporter(telemetry, () => plan)

  telemetry?.trackSubscriptionCancellation('flow_opened', metadata)
  cancelReport.intent()

  try {
    const results = await session.show({
      handleCancel: async () => {
        if (!isLaunchWorkspaceCurrent()) {
          throw new CancellationScopeChangedError(
            t('subscription.cancelDialog.workspaceChanged')
          )
        }
        telemetry?.trackSubscriptionCancellation('confirmed', metadata)
        cancelReport.confirmed({ operationFollows: true })
        try {
          await billing.cancelSubscription(isLaunchWorkspaceCurrent)
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
            surface: 'billing',
            errorType: 'error_refreshing_billing_after_churnkey_discount'
          })
          useToast().warning(
            t('subscription.cancelDialog.discountRefreshFailed'),
            { duration: 8000 }
          )
        })
        return
      case 'abandoned':
        telemetry?.trackSubscriptionCancellation('abandoned', metadata)
        cancelReport.abandoned()
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
    await fallBackAfterSessionFailure(
      error,
      showFallback,
      isLaunchWorkspaceCurrent,
      cancelReport
    )
  }
}
