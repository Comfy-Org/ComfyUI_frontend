import { datadogRum } from '@datadog/browser-rum'

import type {
  ExecutionOutcomeMetadata,
  RunButtonProperties,
  TelemetryProvider,
  WorkflowErrorMetadata
} from '../../types'
import { toWorkflowRunActionContext } from '../../utils/workflowExecutionContext'

export class DatadogRumTelemetryProvider implements TelemetryProvider {
  trackRunButton(properties: RunButtonProperties): void {
    datadogRum.addAction(
      'workflow_queue',
      toWorkflowRunActionContext(properties)
    )
  }

  trackWorkflowError({
    error,
    operation,
    phase,
    workflowContext
  }: WorkflowErrorMetadata): void {
    datadogRum.addError(error, {
      operation,
      phase,
      product: 'cloud_generation',
      ...workflowContext
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
