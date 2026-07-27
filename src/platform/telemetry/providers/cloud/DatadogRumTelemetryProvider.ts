import { datadogRum } from '@datadog/browser-rum'

import type {
  ExecutionOutcomeMetadata,
  TelemetryProvider,
  WorkflowExecutionContext,
  WorkflowExecutionStartedMetadata,
  WorkflowQueuedMetadata,
  WorkflowSubmissionMetadata
} from '../../types'

function funnelStep(
  jobId: string | undefined,
  workflowContext: WorkflowExecutionContext | undefined
) {
  return {
    product: 'cloud_generation',
    ...(jobId && { job_id: jobId }),
    ...(workflowContext ?? {})
  }
}

export class DatadogRumTelemetryProvider implements TelemetryProvider {
  trackWorkflowQueued(metadata: WorkflowQueuedMetadata): void {
    datadogRum.addAction('workflow_queue', metadata)
  }

  trackWorkflowSubmission({
    startTime,
    submittedAt,
    outcome,
    jobId,
    workflowContext
  }: WorkflowSubmissionMetadata): void {
    datadogRum.addAction('workflow_submission', {
      outcome,
      ...funnelStep(jobId, workflowContext)
    })
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

  trackWorkflowExecutionStarted({
    jobId,
    workflowContext
  }: WorkflowExecutionStartedMetadata): void {
    datadogRum.addAction(
      'workflow_execution_start',
      funnelStep(jobId, workflowContext)
    )
  }

  trackExecutionOutcome({
    startTime,
    submittedAt,
    executionStartedAt,
    terminalAt,
    outcome,
    jobId,
    workflowContext
  }: ExecutionOutcomeMetadata): void {
    datadogRum.addAction('workflow_run_finished', {
      outcome,
      ...funnelStep(jobId, workflowContext)
    })
    const originViewId = datadogRum.getInternalContext(startTime)?.view?.id
    const context = {
      outcome,
      product: 'cloud_generation',
      ...(workflowContext ?? {}),
      ...(originViewId && { origin_view_id: originViewId })
    }
    datadogRum.addDurationVital('workflow_execution', {
      startTime: performance.timeOrigin + startTime,
      duration: terminalAt - startTime,
      context
    })
    const timingContext = {
      ...context,
      timing_schema_version: 2
    }
    datadogRum.addDurationVital('workflow_total_time', {
      startTime: performance.timeOrigin + startTime,
      duration: terminalAt - startTime,
      context: timingContext
    })
    if (submittedAt !== undefined && executionStartedAt !== undefined) {
      datadogRum.addDurationVital('workflow_queue_wait', {
        startTime: performance.timeOrigin + submittedAt,
        duration: Math.max(0, executionStartedAt - submittedAt),
        context: timingContext
      })
    }
    if (executionStartedAt === undefined) return
    datadogRum.addDurationVital('workflow_execution_time', {
      startTime: performance.timeOrigin + executionStartedAt,
      duration: terminalAt - executionStartedAt,
      context: {
        ...timingContext
      }
    })
  }
}
