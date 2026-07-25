import { afterEach, describe, expect, it, vi } from 'vitest'

import type { WorkflowQueuedMetadata } from '@/platform/telemetry/types'

import { DatadogRumTelemetryProvider } from './DatadogRumTelemetryProvider'

const { addAction, addDurationVital, getInternalContext } = vi.hoisted(() => ({
  addAction: vi.fn(),
  addDurationVital: vi.fn(),
  getInternalContext: vi.fn()
}))

vi.mock('@datadog/browser-rum', () => ({
  datadogRum: { addAction, addDurationVital, getInternalContext }
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('DatadogRumTelemetryProvider', () => {
  it('records a bounded workflow queue action', () => {
    const metadata: WorkflowQueuedMetadata = {
      subscribe_to_run: false,
      workflow_type: 'custom',
      custom_node_count: 3,
      api_node_count: 1,
      total_node_count: 42,
      executable_node_count: 12,
      subgraph_count: 2,
      trigger_source: 'keybinding',
      execution_scope: 'partial',
      view_mode: 'graph'
    }

    new DatadogRumTelemetryProvider().trackWorkflowQueued(metadata)

    expect(addAction).toHaveBeenCalledWith('workflow_queue', {
      workflow_type: 'custom',
      view_mode: 'graph',
      execution_scope: 'partial',
      total_node_count: 42,
      executable_node_count: 12,
      custom_node_count: 3,
      api_node_count: 1,
      subgraph_count: 2,
      trigger_source: 'keybinding',
      subscribe_to_run: false
    })
  })

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
