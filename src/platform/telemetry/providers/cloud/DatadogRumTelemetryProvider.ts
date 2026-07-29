import { datadogRum } from '@datadog/browser-rum'

import type {
  BillingTelemetryEvent,
  ExecutionOutcomeMetadata,
  TelemetryProvider
} from '../../types'
import {
  getBillingTelemetryEventName,
  getBillingTelemetryEventPayload
} from '../../types'

export class DatadogRumTelemetryProvider implements TelemetryProvider {
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
