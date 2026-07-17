import { afterEach, describe, expect, it, vi } from 'vitest'

import { DatadogRumTelemetryProvider } from './DatadogRumTelemetryProvider'

const addDurationVital = vi.fn()

function installDatadogRum(): void {
  Object.defineProperty(window, 'DD_RUM', {
    configurable: true,
    value: { addDurationVital }
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  Reflect.deleteProperty(window, 'DD_RUM')
})

describe('DatadogRumTelemetryProvider', () => {
  it('records a workflow vital with its duration and outcome', () => {
    installDatadogRum()
    vi.spyOn(performance, 'now').mockReturnValue(142)

    new DatadogRumTelemetryProvider().trackExecutionOutcome({
      startTime: 42,
      outcome: 'success'
    })

    expect(addDurationVital).toHaveBeenCalledWith('workflow_execution', {
      startTime: performance.timeOrigin + 42,
      duration: 100,
      context: {
        outcome: 'success',
        product: 'cloud_generation'
      }
    })
  })

  it('does nothing when Datadog RUM is unavailable', () => {
    expect(() =>
      new DatadogRumTelemetryProvider().trackExecutionOutcome({
        startTime: 42,
        outcome: 'failure'
      })
    ).not.toThrow()
  })
})
