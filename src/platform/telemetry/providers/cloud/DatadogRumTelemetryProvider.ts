import { datadogRum } from '@datadog/browser-rum'

import type {
  ExecutionOutcomeMetadata,
  TelemetryProvider,
  WorkflowQueuedMetadata
} from '../../types'

export class DatadogRumTelemetryProvider implements TelemetryProvider {
  trackWorkflowQueued({
    workflowContext,
    ...metadata
  }: WorkflowQueuedMetadata): void {
    datadogRum.addAction('workflow_queue', {
      ...workflowContext,
      ...metadata
    })
  }

  trackExecutionOutcome({
    startTime,
    submissionAcceptedAt,
    executionStartedAt,
    endTime,
    success,
    failureReason,
    workflowContext
  }: ExecutionOutcomeMetadata): void {
    const originViewId = datadogRum.getInternalContext(startTime)?.view?.id
    const terminalStage =
      executionStartedAt !== undefined
        ? 'execution'
        : submissionAcceptedAt !== undefined
          ? 'queue_wait'
          : 'submission'

    datadogRum.addDurationVital('workflow_execution', {
      startTime: performance.timeOrigin + startTime,
      duration: Math.max(0, endTime - startTime),
      context: {
        success,
        failure_reason: failureReason,
        terminal_stage: terminalStage,
        workflow_started_at_unix_ms: performance.timeOrigin + startTime,
        ...(submissionAcceptedAt !== undefined && {
          submission_accepted_at_unix_ms:
            performance.timeOrigin + submissionAcceptedAt
        }),
        ...(executionStartedAt !== undefined && {
          execution_started_at_unix_ms:
            performance.timeOrigin + executionStartedAt
        }),
        workflow_ended_at_unix_ms: performance.timeOrigin + endTime,
        submission_duration_ms: Math.max(
          0,
          (submissionAcceptedAt ?? endTime) - startTime
        ),
        ...(submissionAcceptedAt !== undefined && {
          queue_wait_duration_ms: Math.max(
            0,
            (executionStartedAt ?? endTime) - submissionAcceptedAt
          )
        }),
        ...(executionStartedAt !== undefined && {
          execution_duration_ms: Math.max(0, endTime - executionStartedAt)
        }),
        product: 'cloud_generation',
        ...(workflowContext ?? {}),
        ...(originViewId && { origin_view_id: originViewId })
      }
    })
  }
}
