import type {
  RetentionFlowEventRequest,
  RetentionFlowResponse
} from '@comfyorg/ingest-types'

import { supportsInAppCancellation } from '@/composables/billing/billingRail'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'
import { reportError } from '@/platform/telemetry/reportError'
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
        errorType: 'failure_preparing_retention_flow',
        level: 'warning'
      })
    }
    return null
  }
}

type RetentionFlowEventOutcome = 'recorded' | 'expired' | 'failed'

export async function recordRetentionFlowEvent(
  sessionId: string,
  event: RetentionFlowEventRequest['event']
): Promise<RetentionFlowEventOutcome> {
  try {
    await workspaceApi.recordRetentionFlowEvent({
      session_id: sessionId,
      event
    })
    return 'recorded'
  } catch (error) {
    if (
      error instanceof WorkspaceApiError &&
      error.code === 'RETENTION_SESSION_STALE'
    ) {
      return 'expired'
    }
    reportError(error, {
      surface: 'billing',
      errorType: 'failure_recording_retention_flow_event',
      context: { event }
    })
    return 'failed'
  }
}

const pendingLaunches = new Map<string | null, Promise<void>>()

export function launchCancellationFlow(
  options: LaunchCancellationFlowOptions
): Promise<void> {
  const launchWorkspaceId =
    options.launchWorkspaceId === undefined
      ? useTeamWorkspaceStore().activeWorkspaceId
      : options.launchWorkspaceId
  const pending = pendingLaunches.get(launchWorkspaceId)
  if (pending) return pending

  const done = showCancellationFlow(
    options.cancelAt,
    launchWorkspaceId,
    options.showFlow
  ).finally(() => pendingLaunches.delete(launchWorkspaceId))
  pendingLaunches.set(launchWorkspaceId, done)
  return done
}

function canOfferRetention(launchWorkspaceId: string | null): boolean {
  const workspaceStore = useTeamWorkspaceStore()
  return (
    useBillingContext().type.value === 'workspace' &&
    !!launchWorkspaceId &&
    workspaceStore.isInPersonalWorkspace &&
    supportsInAppCancellation(workspaceStore.activeWorkspaceBillingRail)
  )
}

function reportFlowNotShown(error: unknown, workspaceStillCurrent: boolean) {
  reportError(error, {
    surface: 'billing',
    errorType: 'error_showing_cancellation_flow',
    tags: { workspace_still_current: workspaceStillCurrent },
    level: workspaceStillCurrent ? 'error' : 'warning'
  })
  if (!workspaceStillCurrent) return
  useToast().error(t('subscription.cancelDialog.failed'), {
    duration: 8000
  })
}

async function showCancellationFlow(
  cancelAt: string | undefined,
  launchWorkspaceId: string | null,
  showFlow: LaunchCancellationFlowOptions['showFlow']
): Promise<void> {
  const workspaceStore = useTeamWorkspaceStore()
  const isScopeCurrent = launchWorkspaceId
    ? () => workspaceStore.activeWorkspaceId === launchWorkspaceId
    : () => true

  const flow = canOfferRetention(launchWorkspaceId)
    ? await prepareRetentionFlow()
    : null
  if (!isScopeCurrent()) return

  try {
    await showFlow({
      cancelAt,
      surveyId: remoteConfig.value.cancellation_survey_id || undefined,
      flow,
      workspaceId: launchWorkspaceId,
      isScopeCurrent
    })
  } catch (error) {
    reportFlowNotShown(error, isScopeCurrent())
  }
}
