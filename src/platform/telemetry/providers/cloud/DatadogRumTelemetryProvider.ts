import { datadogRum } from '@datadog/browser-rum'

import type { ExecutionOutcomeMetadata, TelemetryProvider } from '../../types'

export class DatadogRumTelemetryProvider implements TelemetryProvider {
  trackExecutionOutcome({
    startTime,
    outcome
  }: ExecutionOutcomeMetadata): void {
    datadogRum.addDurationVital('workflow_execution', {
      startTime: performance.timeOrigin + startTime,
      duration: performance.now() - startTime,
      context: {
        outcome,
        product: 'cloud_generation'
      }
    })
  }
}
