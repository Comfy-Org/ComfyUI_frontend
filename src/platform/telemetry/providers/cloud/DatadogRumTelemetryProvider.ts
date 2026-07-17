import type { ExecutionOutcomeMetadata, TelemetryProvider } from '../../types'

interface DatadogRumDurationVitalOptions {
  startTime: number
  duration: number
  context?: Record<string, unknown>
}

interface DatadogRumClient {
  addDurationVital(name: string, options: DatadogRumDurationVitalOptions): void
}

interface WindowWithDatadogRum extends Window {
  DD_RUM?: DatadogRumClient
}

function getDatadogRum(): DatadogRumClient | undefined {
  return (window as WindowWithDatadogRum).DD_RUM
}

export class DatadogRumTelemetryProvider implements TelemetryProvider {
  trackExecutionOutcome({
    startTime,
    outcome
  }: ExecutionOutcomeMetadata): void {
    getDatadogRum()?.addDurationVital('workflow_execution', {
      startTime: performance.timeOrigin + startTime,
      duration: performance.now() - startTime,
      context: {
        outcome,
        product: 'cloud_generation'
      }
    })
  }
}
