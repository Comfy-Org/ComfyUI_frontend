import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTelemetry } from '@/platform/telemetry'

const state = vi.hoisted(() => ({
  executionContext: {
    is_template: false,
    workflow_name: 'Desktop workflow',
    custom_node_count: 2,
    total_node_count: 4,
    subgraph_count: 1,
    has_api_nodes: true,
    api_node_names: ['LoadImage'],
    has_toolkit_nodes: false,
    toolkit_node_names: []
  },
  executionContextError: null as Error | null,
  agentPanelOpen: false
}))

vi.mock(import('@/platform/telemetry'))

vi.mock<unknown>(
  import('@/platform/telemetry/utils/getExecutionContext'),
  () => ({
    getExecutionContext: () => {
      if (state.executionContextError) throw state.executionContextError
      return state.executionContext
    }
  })
)

vi.mock<unknown>(
  import('@/platform/telemetry/utils/getAgentPanelOpen'),
  () => ({
    getAgentPanelOpen: () => state.agentPanelOpen
  })
)

import {
  getRunButtonTelemetryProperties,
  useRunButtonTelemetry
} from './useRunButtonTelemetry'

describe('useRunButtonTelemetry', () => {
  beforeEach(() => {
    state.executionContextError = null
    state.agentPanelOpen = false
  })

  it('builds run button properties from workspace state', () => {
    localStorage.setItem('Comfy.MenuPosition.Docked', 'false')

    expect(
      getRunButtonTelemetryProperties({
        subscribe_to_run: true,
        trigger_source: 'button'
      })
    ).toEqual({
      subscribe_to_run: true,
      workflow_type: 'custom',
      workflow_name: 'Desktop workflow',
      custom_node_count: 2,
      total_node_count: 4,
      subgraph_count: 1,
      has_api_nodes: true,
      api_node_names: ['LoadImage'],
      has_toolkit_nodes: false,
      toolkit_node_names: [],
      trigger_source: 'button',
      view_mode: 'graph',
      is_app_mode: false,
      dock_state: 'floating',
      agent_panel_open: false
    })
  })

  it('reports the agent panel as open when it is open at submit time', () => {
    state.agentPanelOpen = true

    expect(getRunButtonTelemetryProperties()).toMatchObject({
      agent_panel_open: true
    })
  })

  it('tracks the completed run button payload', () => {
    useRunButtonTelemetry().trackRunButton({ trigger_source: 'linear' })

    expect(useTelemetry()?.trackRunButton).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        subscribe_to_run: false,
        trigger_source: 'linear',
        workflow_name: 'Desktop workflow'
      })
    )
  })

  it('does not throw when run button context collection fails', () => {
    const error = new Error('Context unavailable')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    state.executionContextError = error

    try {
      expect(() =>
        useRunButtonTelemetry().trackRunButton({ trigger_source: 'linear' })
      ).not.toThrow()

      expect(useTelemetry()?.trackRunButton).not.toHaveBeenCalled()
      expect(consoleError).toHaveBeenCalledExactlyOnceWith(
        '[Telemetry] Run button tracking failed',
        error
      )
    } finally {
      consoleError.mockRestore()
    }
  })
})
