import { afterEach, describe, expect, it, vi } from 'vitest'

import { DatadogRumTelemetryProvider } from './DatadogRumTelemetryProvider'

const addAction = vi.fn()
const setViewContextProperty = vi.fn()

function installDatadogRum(): void {
  Object.defineProperty(window, 'DD_RUM', {
    configurable: true,
    value: { addAction, setViewContextProperty }
  })
}

function setNavigationType(type?: NavigationTimingType): void {
  vi.spyOn(performance, 'getEntriesByType').mockReturnValue(
    type ? ([{ type }] as PerformanceNavigationTiming[]) : []
  )
}

afterEach(() => {
  addAction.mockReset()
  setViewContextProperty.mockReset()
  vi.restoreAllMocks()
  Reflect.deleteProperty(window, 'DD_RUM')
})

describe('DatadogRumTelemetryProvider', () => {
  it.for([
    { expected: 'navigate', type: 'navigate' },
    { expected: 'reload', type: 'reload' },
    { expected: 'back_forward', type: 'back_forward' },
    { expected: 'prerender', type: 'prerender' },
    { expected: 'unknown', type: undefined }
  ] as const)('sets $expected navigation context', ({ expected, type }) => {
    installDatadogRum()
    setNavigationType(type)

    new DatadogRumTelemetryProvider()

    expect(setViewContextProperty).toHaveBeenCalledWith(
      'navigation_type',
      expected
    )
  })

  it('tracks workflow execution starts', () => {
    installDatadogRum()
    setNavigationType('navigate')

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
      setNavigationType('navigate')
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
