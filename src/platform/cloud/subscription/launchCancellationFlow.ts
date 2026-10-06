import type { RetentionFlowResponse } from '@comfyorg/ingest-types'

import { supportsInAppCancellation } from '@/composables/billing/billingRail'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { t } from '@/i18n'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApiError'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

export interface CancellationFlowDialogOptions {
  cancelAt?: string
  surveyId?: string
  flow: RetentionFlowResponse | null
  workspaceId: string | null
  isScopeCurrent: () => boolean
}

interface LaunchCancellationFlowOptions {
  cancelAt?: string
  launchWorkspaceId?: string | null
  showFlow: (options: CancellationFlowDialogOptions) => unknown
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
  showFlow
}: LaunchCancellationFlowOptions): Promise<void> {
  const billing = useBillingContext()
  const workspaceStore = useTeamWorkspaceStore()
  const launchWorkspaceId =
    capturedWorkspaceId === undefined
      ? workspaceStore.activeWorkspaceId
      : capturedWorkspaceId
  const isScopeCurrent = launchWorkspaceId
    ? () => workspaceStore.activeWorkspaceId === launchWorkspaceId
    : () => true
  const canOfferRetention =
    billing.type.value === 'workspace' &&
    !!launchWorkspaceId &&
    supportsInAppCancellation(workspaceStore.activeWorkspaceBillingRail)

  const flow = canOfferRetention ? await prepareRetentionFlow() : null
  if (!isScopeCurrent()) return
  if (flow) recordFlowOpened(flow.session_id)

  try {
    await showFlow({
      cancelAt,
      surveyId: remoteConfig.value.cancellation_survey_id || undefined,
      flow,
      workspaceId: launchWorkspaceId ?? null,
      isScopeCurrent
    })
  } catch (error) {
    const workspaceStillCurrent = isScopeCurrent()
    reportError(error, {
      surface: 'billing',
      errorType: 'cloud_cancellation_flow_failed',
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
