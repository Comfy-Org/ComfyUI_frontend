import { useBillingContext } from '@/composables/billing/useBillingContext'
import { t } from '@/i18n'
import { prepareChurnkey } from '@/platform/cloud/churnkey/churnkeyClient'
import type { ChurnkeySession } from '@/platform/cloud/churnkey/churnkeyClient'
import type { ChurnkeySessionOutcome } from '@/platform/cloud/churnkey/types'
import { getSubscriptionCancellationMetadata } from '@/platform/cloud/subscription/utils/subscriptionCancellationTelemetry'
import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { CancellationScopeChangedError } from '@/platform/workspace/composables/useWorkspaceBilling'
import type { DialogInstance } from '@/stores/dialogStore'
import { getErrorMessage, toError } from '@/utils/errorUtil'

interface CancellationFallbackOptions {
  flowAlreadyOpened?: boolean
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
  useToastStore().add({
    severity: 'error',
    summary: t('subscription.cancelDialog.failed'),
    life: 8000
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

let activeFlow: Promise<void> | undefined

type BillingContext = ReturnType<typeof useBillingContext>

function supportsChurnkey(
  billing: BillingContext,
  workspaceStore: ReturnType<typeof useTeamWorkspaceStore>,
  workspaceId: string | null
): boolean {
  return (
    billing.type.value === 'workspace' &&
    !!workspaceId &&
    workspaceStore.activeWorkspaceBillingRail === 'stripe'
  )
}

async function cancelCurrentSubscription(
  billing: BillingContext,
  isScopeCurrent: () => boolean,
  onConfirm: () => void
) {
  if (!isScopeCurrent()) {
    throw new CancellationScopeChangedError(
      t('subscription.cancelDialog.workspaceChanged')
    )
  }
  onConfirm()
  try {
    await billing.cancelSubscription(isScopeCurrent)
    return { message: t('subscription.cancelSuccess') }
  } catch (error) {
    throw new Error(
      getErrorMessage(error) ?? t('subscription.cancelDialog.failed'),
      { cause: error }
    )
  }
}

async function handleSessionOutcome(
  result: ChurnkeySessionOutcome,
  billing: BillingContext,
  isScopeCurrent: () => boolean,
  onAbandoned: () => void
): Promise<void> {
  switch (result.type) {
    case 'discount-applied':
      if (!isScopeCurrent()) return
      await billing.fetchStatus().catch((error) => {
        reportError(error, {
          surface: 'billing',
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
      onAbandoned()
      return
    case 'billing-pending':
      useToastStore().add({
        severity: 'warn',
        summary: t('subscription.cancelDialog.retentionPending'),
        life: 10000
      })
      return
    case 'closed':
      return
    default: {
      const unreachable: never = result
      return unreachable
    }
  }
}

export function launchCancellationFlow(
  options: LaunchCancellationFlowOptions
): Promise<void> {
  activeFlow ??= runCancellationFlow(options).finally(() => {
    activeFlow = undefined
  })
  return activeFlow
}

async function runCancellationFlow({
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
  if (!supportsChurnkey(billing, workspaceStore, launchWorkspaceId)) {
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

  telemetry?.trackSubscriptionCancellation('flow_opened', metadata)

  try {
    const results = await session.show({
      workspaceId: launchWorkspaceId ?? undefined,
      isWorkspaceCurrent: isLaunchWorkspaceCurrent,
      handleCancel: () =>
        cancelCurrentSubscription(billing, isLaunchWorkspaceCurrent, () => {
          telemetry?.trackSubscriptionCancellation('confirmed', metadata)
        })
    })
    await handleSessionOutcome(results, billing, isLaunchWorkspaceCurrent, () =>
      telemetry?.trackSubscriptionCancellation('abandoned', metadata)
    )
  } catch (error) {
    if (!isLaunchWorkspaceCurrent()) return
    telemetry?.trackSubscriptionCancellation('failed', {
      ...metadata,
      error_message: getErrorMessage(error) ?? t('g.unknownError')
    })
    await showCancellationFallback(
      showFallback,
      isLaunchWorkspaceCurrent,
      { flowAlreadyOpened: true },
      { stage: 'session', error }
    )
  }
}
