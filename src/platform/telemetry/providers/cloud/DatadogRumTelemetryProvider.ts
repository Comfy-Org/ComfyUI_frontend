import type { ExecutionOutcomeMetadata, TelemetryProvider } from '../../types'

export class DatadogRumTelemetryProvider implements TelemetryProvider {
  trackExecutionOutcome({
    startTime,
    outcome
  }: ExecutionOutcomeMetadata): void {
    window.DD_RUM?.addDurationVital('workflow_execution', {
      startTime: performance.timeOrigin + startTime,
      duration: performance.now() - startTime,
      context: {
        outcome,
        product: 'cloud_generation'
      }
    })
  }
}
