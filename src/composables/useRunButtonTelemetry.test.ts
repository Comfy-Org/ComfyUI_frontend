import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  mode: { value: 'graph' },
  isAppMode: { value: false },
  telemetry: {
    trackRunButton: vi.fn()
  },
  executionContext: {
    is_template: false,
    workflow_name: 'Desktop workflow',
    custom_node_count: 2,
    api_node_count: 1,
    total_node_count: 4,
    subgraph_count: 1,
    has_api_nodes: true,
    api_node_names: ['LoadImage'],
    has_toolkit_nodes: false,
    toolkit_node_names: []
  },
  executionContextError: null as Error | null
}))

vi.mock('@/composables/useAppMode', () => ({
  useAppMode: () => ({
    mode: state.mode,
    isAppMode: state.isAppMode
  })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => state.telemetry
}))

vi.mock('@/scripts/app', () => ({
  app: { rootGraph: {} }
}))

vi.mock('@/platform/telemetry/utils/getExecutionContext', () => ({
  getExecutionContext: () => {
    if (state.executionContextError) throw state.executionContextError
    return state.executionContext
  }
}))

import {
  getRunButtonTelemetryProperties,
  useRunButtonTelemetry
} from './useRunButtonTelemetry'

describe('useRunButtonTelemetry', () => {
  beforeEach(() => {
    localStorage.clear()
    state.telemetry.trackRunButton.mockClear()
    state.mode.value = 'graph'
    state.isAppMode.value = false
    state.executionContextError = null
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
      api_node_count: 1,
      total_node_count: 4,
      subgraph_count: 1,
      has_api_nodes: true,
      api_node_names: ['LoadImage'],
      has_toolkit_nodes: false,
      toolkit_node_names: [],
      trigger_source: 'button',
      execution_scope: 'full',
      view_mode: 'graph',
      is_app_mode: false,
      dock_state: 'floating'
    })
  })

  it('tracks the completed run button payload', () => {
    useRunButtonTelemetry().trackRunButton({ trigger_source: 'linear' })

    expect(state.telemetry.trackRunButton).toHaveBeenCalledExactlyOnceWith(
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

      expect(state.telemetry.trackRunButton).not.toHaveBeenCalled()
      expect(consoleError).toHaveBeenCalledExactlyOnceWith(
        '[Telemetry] Run button tracking failed',
        error
      )
    } finally {
      consoleError.mockRestore()
    }
  })
})
