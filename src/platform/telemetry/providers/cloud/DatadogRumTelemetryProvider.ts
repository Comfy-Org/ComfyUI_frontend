import {
  getBillingTelemetryEventName,
  getCheckoutJourneyTelemetryEventName,
  getCloudAppBillingTelemetryEventPayload,
  getCloudAppCheckoutJourneyTelemetryEventPayload
} from '@comfyorg/account-core/billing'
import type {
  BillingTelemetryEvent,
  CheckoutJourneyTelemetryEvent
} from '@comfyorg/account-core/billing'
import type {
  SsoTelemetryEvent,
  WebSessionTelemetryEvent
} from '@comfyorg/account-core/telemetry'
// oxlint-disable-next-line no-restricted-imports -- the telemetry layer owns the sinks that reportError() fans out to
import { datadogRum } from '@datadog/browser-rum'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { CORE_COLOR_PALETTES } from '@/constants/coreColorPalettes'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

import type {
  AuthMetadata,
  BootstrapCompleteMetadata,
  ExecutionOutcomeMetadata,
  FetchTimeoutMetadata,
  ImageLoadFailureMetadata,
  TelemetryProvider,
  UnifiedAuthRefreshMetadata,
  UnifiedAuthRetryMetadata,
  WorkspaceScopeMismatchMetadata,
  WorkspaceTelemetryContext
} from '@/platform/telemetry/types'
import { TelemetryEvents } from '@/platform/telemetry/types'

export class DatadogRumTelemetryProvider implements TelemetryProvider {
  private isWatchingLogout = false

  trackAuth({ user_id, email }: AuthMetadata): void {
    this.setUser(user_id, email)
  }

  trackUserLoggedIn(): void {
    const { resolvedUserInfo, userEmail } = useCurrentUser()
    this.setUser(resolvedUserInfo.value?.id, userEmail.value)
  }

  private setUser(userId: string | undefined, email?: string | null): void {
    if (!userId) return

    datadogRum.setUser({ id: userId, ...(email && { email }) })
    if (this.isWatchingLogout) return

    this.isWatchingLogout = true
    useCurrentUser().onUserLogout(() => datadogRum.clearUser())
  }

  trackFetchTimeout(metadata: FetchTimeoutMetadata): void {
    datadogRum.addAction(TelemetryEvents.FETCH_TIMEOUT, metadata)
  }

  trackUnifiedAuthRetry(metadata: UnifiedAuthRetryMetadata): void {
    datadogRum.addAction(
      metadata.outcome === 'succeeded'
        ? TelemetryEvents.UNIFIED_AUTH_RETRY_SUCCEEDED
        : TelemetryEvents.UNIFIED_AUTH_RETRY_FAILED,
      metadata
    )
  }

  trackUnifiedAuthRefresh(metadata: UnifiedAuthRefreshMetadata): void {
    datadogRum.addAction(
      metadata.outcome === 'succeeded'
        ? TelemetryEvents.UNIFIED_AUTH_REFRESH_SUCCEEDED
        : TelemetryEvents.UNIFIED_AUTH_REFRESH_FAILED,
      metadata
    )
  }

  trackWebSessionEvent(event: WebSessionTelemetryEvent): void {
    datadogRum.addAction(event.name, event.properties)
  }

  trackSsoEvent(event: SsoTelemetryEvent): void {
    datadogRum.addAction(event.name, event.properties)
  }

  trackImageLoadFailed(metadata: ImageLoadFailureMetadata): void {
    datadogRum.addAction(TelemetryEvents.IMAGE_LOAD_FAILED, metadata)
  }

  trackBootstrapComplete({ outcome }: BootstrapCompleteMetadata): void {
    if (outcome !== 'completed') return

    const { completedActivePalette, colorScheme } = useColorPaletteStore()
    datadogRum.addAction(TelemetryEvents.THEME_LOADED, {
      theme: Object.hasOwn(CORE_COLOR_PALETTES, completedActivePalette.id)
        ? completedActivePalette.id
        : 'custom',
      color_scheme: colorScheme
    })
  }

  trackFeatureFlagEvaluation(key: string, value: unknown): void {
    datadogRum.addFeatureFlagEvaluation(
      key.replace(/[.:+\-=&|><!(){}[\]^"“”~*?\\\s]/g, '_'),
      value
    )
  }

  trackBillingEvent(event: BillingTelemetryEvent): void {
    datadogRum.addAction(
      getBillingTelemetryEventName(event),
      getCloudAppBillingTelemetryEventPayload(event)
    )
  }

  // fallow-ignore-next-line unused-class-member
  setWorkspaceContext(context: WorkspaceTelemetryContext | undefined): void {
    if (!context) {
      datadogRum.removeGlobalContextProperty('workspace')
      datadogRum.removeGlobalContextProperty('auth')
      return
    }
    datadogRum.setGlobalContextProperty('workspace', {
      id: context.workspace_id,
      type: context.workspace_type,
      role: context.workspace_role,
      tier: context.workspace_tier
    })
    datadogRum.setGlobalContextProperty('auth', { rail: context.auth_rail })
  }

  // fallow-ignore-next-line unused-class-member
  trackWorkspaceScopeMismatch(metadata: WorkspaceScopeMismatchMetadata): void {
    datadogRum.addAction(TelemetryEvents.WORKSPACE_SCOPE_MISMATCH, metadata)
  }

  trackCheckoutJourneyEvent(event: CheckoutJourneyTelemetryEvent): void {
    datadogRum.addAction(
      getCheckoutJourneyTelemetryEventName(event),
      getCloudAppCheckoutJourneyTelemetryEventPayload(event)
    )
  }

  trackExecutionOutcome({
    startTime,
    submissionAcceptedAt,
    executionStartedAt,
    endTime,
    success,
    failureReason,
    workflowContext,
    trigger_source
  }: ExecutionOutcomeMetadata): void {
    const originViewId = datadogRum.getInternalContext(startTime)?.view?.id
    const submissionStageAcceptedAt =
      submissionAcceptedAt === undefined
        ? undefined
        : Math.max(startTime, submissionAcceptedAt)
    const executionStageStartedAt =
      executionStartedAt === undefined
        ? undefined
        : Math.max(executionStartedAt, submissionStageAcceptedAt ?? startTime)
    const workflowEndedAt = Math.max(
      endTime,
      executionStageStartedAt ?? submissionStageAcceptedAt ?? startTime
    )
    const terminalStage =
      executionStageStartedAt !== undefined
        ? 'execution'
        : submissionAcceptedAt !== undefined
          ? 'queue_wait'
          : 'submission'

    datadogRum.addDurationVital('workflow_execution', {
      startTime: performance.timeOrigin + startTime,
      duration: workflowEndedAt - startTime,
      context: {
        success,
        failure_reason: failureReason,
        terminal_stage: terminalStage,
        trigger_source,
        workflow_started_at_unix_ms: performance.timeOrigin + startTime,
        ...(submissionStageAcceptedAt !== undefined && {
          submission_accepted_at_unix_ms:
            performance.timeOrigin + submissionStageAcceptedAt
        }),
        ...(executionStageStartedAt !== undefined && {
          execution_started_at_unix_ms:
            performance.timeOrigin + executionStageStartedAt
        }),
        workflow_ended_at_unix_ms: performance.timeOrigin + workflowEndedAt,
        submission_duration_ms:
          (submissionStageAcceptedAt ?? workflowEndedAt) - startTime,
        ...(submissionStageAcceptedAt !== undefined && {
          queue_wait_duration_ms:
            (executionStageStartedAt ?? workflowEndedAt) -
            submissionStageAcceptedAt
        }),
        ...(executionStageStartedAt !== undefined && {
          execution_duration_ms: workflowEndedAt - executionStageStartedAt
        }),
        ...workflowContext,
        ...(originViewId && { origin_view_id: originViewId })
      }
    })
  }
}
