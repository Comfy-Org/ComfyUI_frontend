import { afterEach, describe, expect, it, vi } from 'vitest'

import { DatadogRumTelemetryProvider } from './DatadogRumTelemetryProvider'

const addAction = vi.fn()

function installDatadogRum(): void {
  Object.defineProperty(window, 'DD_RUM', {
    configurable: true,
    value: { addAction }
  })
}

afterEach(() => {
  addAction.mockReset()
  Reflect.deleteProperty(window, 'DD_RUM')
})

describe('DatadogRumTelemetryProvider', () => {
  it('tracks workflow execution starts', () => {
    installDatadogRum()

    new DatadogRumTelemetryProvider().trackWorkflowExecution()

    expect(addAction).toHaveBeenCalledWith('workflow_execution_started', {
      product: 'cloud_generation',
      product_surface: 'workspace'
    })
  })

  it.for([
    {
      outcome: 'success',
      trackOutcome: (provider: DatadogRumTelemetryProvider) =>
        provider.trackExecutionSuccess()
    },
    {
      outcome: 'failure',
      trackOutcome: (provider: DatadogRumTelemetryProvider) =>
        provider.trackExecutionError()
    }
  ] as const)(
    'tracks workflow $outcome outcomes',
    ({ outcome, trackOutcome }) => {
      installDatadogRum()
      const provider = new DatadogRumTelemetryProvider()

      trackOutcome(provider)

      expect(addAction).toHaveBeenCalledWith('workflow_execution_completed', {
        outcome,
        product: 'cloud_generation',
        product_surface: 'workspace'
      })
    }
  )

  it('does nothing when Datadog RUM is unavailable', () => {
    const provider = new DatadogRumTelemetryProvider()

    expect(() => provider.trackWorkflowExecution()).not.toThrow()
    expect(() => provider.trackExecutionSuccess()).not.toThrow()
    expect(() => provider.trackExecutionError()).not.toThrow()
    expect(addAction).not.toHaveBeenCalled()
  })
})
