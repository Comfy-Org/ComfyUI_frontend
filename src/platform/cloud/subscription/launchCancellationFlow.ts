import type {
  RetentionFlowResponse,
  RetentionFlowSubscription,
  RetentionOffer
} from '@comfyorg/ingest-types'

import { supportsInAppCancellation } from '@/composables/billing/billingRail'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { t } from '@/i18n'
import type { RetentionOfferOutcome } from '@/platform/cloud/subscription/utils/retentionOffer'
import {
  createCancelFlowReporter,
  getSubscriptionCancellationMetadata
} from '@/platform/cloud/subscription/utils/subscriptionCancellationTelemetry'
import { useTelemetry } from '@/platform/telemetry'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApiError'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import type { DialogInstance } from '@/stores/dialogStore'

interface CancellationFallbackOptions {
  flowAlreadyOpened?: boolean
  flowAlreadyConfirmed?: boolean
  isScopeCurrent?: () => boolean
}

export interface RetentionOfferDialogOptions {
  offer: RetentionOffer
  subscription: RetentionFlowSubscription
  sessionId: string
  workspaceId: string
  isScopeCurrent: () => boolean
}

interface LaunchCancellationFlowOptions {
  cancelAt?: string
  launchWorkspaceId?: string | null
  showFallback: (
    options?: CancellationFallbackOptions
  ) => boolean | DialogInstance | Promise<boolean | DialogInstance>
  showRetentionOffer: (
    options: RetentionOfferDialogOptions
  ) => Promise<RetentionOfferOutcome>
}

async function showCancellationFallback(
  showFallback: LaunchCancellationFlowOptions['showFallback'],
  isScopeCurrent: () => boolean,
  options?: CancellationFallbackOptions
): Promise<void> {
  if (!isScopeCurrent()) return
  try {
    await showFallback({ ...options, isScopeCurrent })
  } catch (fallbackError) {
    const workspaceStillCurrent = isScopeCurrent()
    reportError(fallbackError, {
      surface: 'billing',
      errorType: 'cloud_cancellation_fallback_failed',
      tags: { workspace_still_current: workspaceStillCurrent },
      level: workspaceStillCurrent ? 'error' : 'warning'
    })
    if (!workspaceStillCurrent) return
    useToastStore().add({
      severity: 'error',
      summary: t('subscription.cancelDialog.failed'),
      life: 8000
    })
  }
}

function offersUnavailable(error: unknown): boolean {
  return (
    error instanceof WorkspaceApiError &&
    (error.status === 422 || error.status === 503)
  )
}

async function prepareRetentionFlow(): Promise<RetentionFlowResponse | null> {
  try {
    return await workspaceApi.prepareRetentionFlow()
  } catch (error) {
    if (!offersUnavailable(error)) {
      reportError(error, {
        surface: 'billing',
        errorType: 'cloud_cancellation_offer_unavailable',
        level: 'warning'
      })
    }
    return null
  }
}

function recordFlowOpened(sessionId: string) {
  workspaceApi
    .recordRetentionFlowEvent({ session_id: sessionId, event: 'flow_opened' })
    .catch((error: unknown) =>
      reportError(error, {
        surface: 'billing',
        errorType: 'retention_flow_exposure_not_recorded'
      })
    )
}

export async function launchCancellationFlow({
  cancelAt,
  launchWorkspaceId: capturedWorkspaceId,
  showFallback,
  showRetentionOffer
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

  const flow = await prepareRetentionFlow()
  if (!isLaunchWorkspaceCurrent()) return
  if (flow) recordFlowOpened(flow.session_id)
  if (!flow?.offer) {
    await showCancellationFallback(showFallback, isLaunchWorkspaceCurrent)
    return
  }

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

  const outcome = await showRetentionOffer({
    offer: flow.offer,
    subscription: flow.subscription,
    sessionId: flow.session_id,
    workspaceId: launchWorkspaceId,
    isScopeCurrent: isLaunchWorkspaceCurrent
  }).catch((error: unknown) => {
    reportError(error, {
      surface: 'billing',
      errorType: 'retention_offer_dialog_failed'
    })
    return 'continueToCancel' as const
  })

  switch (outcome) {
    case 'continueToCancel':
      await showCancellationFallback(showFallback, isLaunchWorkspaceCurrent, {
        flowAlreadyOpened: true
      })
      return
    case 'dismissed':
      telemetry?.trackSubscriptionCancellation('abandoned', metadata)
      cancelReport.abandoned()
      return
    case 'pending':
      useToastStore().add({
        severity: 'warn',
        summary: t('subscription.retentionOffer.pendingToast'),
        life: 10000
      })
      return
    case 'retained':
      return
  }
}
