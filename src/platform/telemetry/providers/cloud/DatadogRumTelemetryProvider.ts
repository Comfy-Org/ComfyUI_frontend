// eslint-disable-next-line no-restricted-imports -- the telemetry layer owns the sinks that reportError() fans out to
import { datadogRum } from '@datadog/browser-rum'

import type {
  BillingTelemetryEvent,
  ExecutionOutcomeMetadata,
  ImageLoadFailureMetadata,
  TelemetryProvider,
  UnifiedAuthRefreshMetadata,
  UnifiedAuthRetryMetadata
} from '../../types'
import {
  getBillingTelemetryEventName,
  getBillingTelemetryEventPayload,
  TelemetryEvents
} from '../../types'

export class DatadogRumTelemetryProvider implements TelemetryProvider {
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

  trackImageLoadFailed(metadata: ImageLoadFailureMetadata): void {
    datadogRum.addAction(TelemetryEvents.IMAGE_LOAD_FAILED, metadata)
  }

  trackBillingEvent(event: BillingTelemetryEvent): void {
    datadogRum.addAction(
      getBillingTelemetryEventName(event),
      getBillingTelemetryEventPayload(event)
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
        ...(workflowContext ?? {}),
        ...(originViewId && { origin_view_id: originViewId })
      }
    })
  }
}
