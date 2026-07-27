import { afterEach, describe, expect, it, vi } from 'vitest'

import { DatadogRumTelemetryProvider } from './DatadogRumTelemetryProvider'

const { addDurationVital, getInternalContext } = vi.hoisted(() => ({
  addDurationVital: vi.fn(),
  getInternalContext: vi.fn()
}))

vi.mock('@datadog/browser-rum', () => ({
  datadogRum: { addDurationVital, getInternalContext }
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('DatadogRumTelemetryProvider', () => {
  it.for(['success', 'failure'] as const)(
    'records a workflow vital with a %s outcome',
    (outcome) => {
      getInternalContext.mockReturnValue({ view: { id: 'view-a' } })
      vi.spyOn(performance, 'now').mockReturnValue(142)

      new DatadogRumTelemetryProvider().trackExecutionOutcome({
        startTime: 42,
        outcome
      })

      expect(getInternalContext).toHaveBeenCalledWith(42)
      expect(addDurationVital).toHaveBeenCalledWith('workflow_execution', {
        startTime: performance.timeOrigin + 42,
        duration: 100,
        context: {
          origin_view_id: 'view-a',
          outcome,
          product: 'cloud_generation'
        }
      })
    }
  )
})
