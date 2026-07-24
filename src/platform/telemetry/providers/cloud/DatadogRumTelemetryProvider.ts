import { datadogRum } from '@datadog/browser-rum'

import type {
  ExecutionOutcomeMetadata,
  TelemetryProvider,
  WorkflowQueuedMetadata,
  WorkflowSubmissionMetadata
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

  trackWorkflowSubmission({
    startTime,
    submittedAt,
    outcome,
    workflowContext
  }: WorkflowSubmissionMetadata): void {
    const originViewId = datadogRum.getInternalContext(startTime)?.view?.id
    datadogRum.addDurationVital('workflow_submission', {
      startTime: performance.timeOrigin + startTime,
      duration: submittedAt - startTime,
      context: {
        outcome,
        product: 'cloud_generation',
        timing_schema_version: 2,
        ...(workflowContext ?? {}),
        ...(originViewId && { origin_view_id: originViewId })
      }
    })
  }

  trackExecutionOutcome({
    startTime,
    outcome,
    workflowContext
  }: ExecutionOutcomeMetadata): void {
    const originViewId = datadogRum.getInternalContext(startTime)?.view?.id
    datadogRum.addDurationVital('workflow_execution', {
      startTime: performance.timeOrigin + startTime,
      duration: performance.now() - startTime,
      context: {
        outcome,
        product: 'cloud_generation',
        ...(workflowContext ?? {}),
        ...(originViewId && { origin_view_id: originViewId })
      }
    })
  }
}
