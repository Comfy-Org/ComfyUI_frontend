import { datadogRum } from '@datadog/browser-rum'

import type {
  ExecutionOutcomeMetadata,
  TelemetryProvider,
  WorkflowQueuedMetadata
} from '../../types'

export class DatadogRumTelemetryProvider implements TelemetryProvider {
  trackWorkflowQueued(metadata: WorkflowQueuedMetadata): void {
    datadogRum.addAction('workflow_queue', metadata)
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
