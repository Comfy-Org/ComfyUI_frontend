import { afterEach, describe, expect, it, vi } from 'vitest'

import type { RunButtonProperties } from '@/platform/telemetry/types'

import { DatadogRumTelemetryProvider } from './DatadogRumTelemetryProvider'

const { addAction, addDurationVital, addError, getInternalContext } =
  vi.hoisted(() => ({
    addAction: vi.fn(),
    addDurationVital: vi.fn(),
    addError: vi.fn(),
    getInternalContext: vi.fn()
  }))

vi.mock('@datadog/browser-rum', () => ({
  datadogRum: { addAction, addDurationVital, addError, getInternalContext }
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('DatadogRumTelemetryProvider', () => {
  it('records a bounded workflow queue action', () => {
    const properties: RunButtonProperties = {
      subscribe_to_run: false,
      workflow_type: 'custom',
      workflow_name: 'Private client workflow',
      custom_node_count: 3,
      api_node_count: 1,
      total_node_count: 42,
      subgraph_count: 2,
      has_api_nodes: true,
      api_node_names: ['PartnerNode'],
      has_toolkit_nodes: false,
      toolkit_node_names: [],
      trigger_source: 'keybinding',
      execution_scope: 'partial',
      view_mode: 'graph',
      is_app_mode: false,
      dock_state: 'docked'
    }

    new DatadogRumTelemetryProvider().trackRunButton(properties)

    expect(addAction).toHaveBeenCalledWith('workflow_queue', {
      workflow_type: 'custom',
      view_mode: 'graph',
      execution_scope: 'partial',
      total_node_count: 42,
      custom_node_count: 3,
      api_node_count: 1,
      subgraph_count: 2,
      complexity_bucket: 'medium',
      dependency_profile: 'mixed',
      trigger_source: 'keybinding',
      subscribe_to_run: false
    })
  })

  it('records an unexpected handled workflow error with bounded context', () => {
    const error = new Error('Network client failed')
    const workflowContext = {
      workflow_type: 'custom',
      view_mode: 'graph',
      execution_scope: 'full',
      total_node_count: 42,
      executable_node_count: 12,
      custom_node_count: 3,
      api_node_count: 1,
      subgraph_count: 2,
      complexity_bucket: 'medium',
      dependency_profile: 'mixed'
    } as const

    new DatadogRumTelemetryProvider().trackWorkflowError({
      error,
      operation: 'workflow_queue',
      phase: 'submit',
      workflowContext
    })

    expect(addError).toHaveBeenCalledWith(error, {
      operation: 'workflow_queue',
      phase: 'submit',
      product: 'cloud_generation',
      ...workflowContext
    })
  })

  it.for(['success', 'failure'] as const)(
    'records a workflow vital with a %s outcome',
    (outcome) => {
      getInternalContext.mockReturnValue({ view: { id: 'view-a' } })
      vi.spyOn(performance, 'now').mockReturnValue(142)

      new DatadogRumTelemetryProvider().trackExecutionOutcome({
        startTime: 42,
        outcome,
        workflowContext: {
          workflow_type: 'custom',
          view_mode: 'graph',
          execution_scope: 'full',
          total_node_count: 42,
          executable_node_count: 12,
          custom_node_count: 3,
          api_node_count: 1,
          subgraph_count: 2,
          complexity_bucket: 'medium',
          dependency_profile: 'mixed'
        }
      })

      expect(getInternalContext).toHaveBeenCalledWith(42)
      expect(addDurationVital).toHaveBeenCalledWith('workflow_execution', {
        startTime: performance.timeOrigin + 42,
        duration: 100,
        context: {
          api_node_count: 1,
          complexity_bucket: 'medium',
          custom_node_count: 3,
          dependency_profile: 'mixed',
          executable_node_count: 12,
          execution_scope: 'full',
          origin_view_id: 'view-a',
          outcome,
          product: 'cloud_generation',
          subgraph_count: 2,
          total_node_count: 42,
          view_mode: 'graph',
          workflow_type: 'custom'
        }
      })
    }
  )
})
