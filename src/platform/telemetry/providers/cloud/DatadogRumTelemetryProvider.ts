import type { TelemetryProvider } from '../../types'

interface DatadogRumClient {
  addAction(name: string, context?: Record<string, unknown>): void
}

interface WindowWithDatadogRum extends Window {
  DD_RUM?: DatadogRumClient
}

const WORKFLOW_CONTEXT = {
  product: 'cloud_generation',
  product_surface: 'workspace'
} as const

function getDatadogRum(): DatadogRumClient | undefined {
  return (window as WindowWithDatadogRum).DD_RUM
}

export class DatadogRumTelemetryProvider implements TelemetryProvider {
  trackWorkflowExecution(): void {
    getDatadogRum()?.addAction('workflow_execution_started', WORKFLOW_CONTEXT)
  }

  trackExecutionSuccess(): void {
    this.trackTerminalOutcome('success')
  }

  trackExecutionError(): void {
    this.trackTerminalOutcome('failure')
  }

  private trackTerminalOutcome(outcome: 'success' | 'failure'): void {
    getDatadogRum()?.addAction('workflow_execution_completed', {
      ...WORKFLOW_CONTEXT,
      outcome
    })
  }
}
