import { afterEach, describe, expect, it, vi } from 'vitest'

import type {
  WorkflowExecutionContext,
  WorkflowQueuedMetadata
} from '@/platform/telemetry/types'

import { DatadogRumTelemetryProvider } from './DatadogRumTelemetryProvider'

const { addAction, addDurationVital, getInternalContext } = vi.hoisted(() => ({
  addAction: vi.fn(),
  addDurationVital: vi.fn(),
  getInternalContext: vi.fn()
}))

vi.mock('@datadog/browser-rum', () => ({
  datadogRum: { addAction, addDurationVital, getInternalContext }
}))

const workflowContext = {
  workflow_type: 'custom',
  view_mode: 'graph',
  execution_scope: 'full',
  total_node_count: 42,
  executable_node_count: 12,
  custom_node_count: 3,
  api_node_count: 1,
  subgraph_count: 2
} satisfies WorkflowExecutionContext

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  getInternalContext.mockReset()
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

  it('records workflow submission timing and outcome', () => {
    getInternalContext.mockReturnValue({ view: { id: 'view-a' } })

    new DatadogRumTelemetryProvider().trackWorkflowSubmission({
      startTime: 42,
      submittedAt: 92,
      outcome: 'accepted',
      workflowContext
    })

    expect(addDurationVital).toHaveBeenCalledWith('workflow_submission', {
      startTime: performance.timeOrigin + 42,
      duration: 50,
      context: {
        api_node_count: 1,
        custom_node_count: 3,
        executable_node_count: 12,
        execution_scope: 'full',
        origin_view_id: 'view-a',
        outcome: 'accepted',
        product: 'cloud_generation',
        subgraph_count: 2,
        timing_schema_version: 2,
        total_node_count: 42,
        view_mode: 'graph',
        workflow_type: 'custom'
      }
    })
  })

  it.for(['success', 'failure', 'interrupted'] as const)(
    'records workflow phase timing with a %s outcome',
    (outcome) => {
      getInternalContext.mockReturnValue({ view: { id: 'view-a' } })

      new DatadogRumTelemetryProvider().trackExecutionOutcome({
        startTime: 42,
        submittedAt: 92,
        executionStartedAt: 142,
        terminalAt: 242,
        outcome,
        workflowContext
      })

      expect(getInternalContext).toHaveBeenCalledWith(42)
      const context = {
        ...workflowContext,
        origin_view_id: 'view-a',
        outcome,
        product: 'cloud_generation'
      }
      const timingContext = { ...context, timing_schema_version: 2 }
      expect(addDurationVital.mock.calls).toEqual([
        [
          'workflow_execution',
          {
            startTime: performance.timeOrigin + 42,
            duration: 200,
            context
          }
        ],
        [
          'workflow_total_time',
          {
            startTime: performance.timeOrigin + 42,
            duration: 200,
            context: timingContext
          }
        ],
        [
          'workflow_queue_wait',
          {
            startTime: performance.timeOrigin + 92,
            duration: 50,
            context: timingContext
          }
        ],
        [
          'workflow_execution_time',
          {
            startTime: performance.timeOrigin + 142,
            duration: 100,
            context: timingContext
          }
        ]
      ])
    }
  )

  it('clamps queue wait when execution starts before the response arrives', () => {
    new DatadogRumTelemetryProvider().trackExecutionOutcome({
      startTime: 42,
      executionStartedAt: 92,
      submittedAt: 142,
      terminalAt: 242,
      outcome: 'success'
    })

    expect(addDurationVital).toHaveBeenCalledWith('workflow_queue_wait', {
      startTime: performance.timeOrigin + 142,
      duration: 0,
      context: {
        outcome: 'success',
        product: 'cloud_generation',
        timing_schema_version: 2
      }
    })
  })
})
