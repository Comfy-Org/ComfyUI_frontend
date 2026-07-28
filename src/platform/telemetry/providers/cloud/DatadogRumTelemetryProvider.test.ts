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
      trigger_source: 'keybinding',
      workflowContext: {
        workflow_type: 'custom',
        custom_node_count: 3,
        api_node_count: 1,
        total_node_count: 42,
        executable_node_count: 12,
        subgraph_count: 2,
        execution_scope: 'partial',
        view_mode: 'graph'
      }
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

  it('records one successful workflow vital with every stage', () => {
    getInternalContext.mockReturnValue({ view: { id: 'view-a' } })

    new DatadogRumTelemetryProvider().trackExecutionOutcome({
      startTime: 42,
      submissionAcceptedAt: 62,
      executionStartedAt: 92,
      endTime: 142,
      success: true,
      failureReason: '',
      workflowContext: {
        workflow_type: 'custom',
        view_mode: 'graph',
        execution_scope: 'full',
        total_node_count: 42,
        executable_node_count: 12,
        custom_node_count: 3,
        api_node_count: 1,
        subgraph_count: 2
      }
    })

    expect(getInternalContext).toHaveBeenCalledWith(42)
    expect(addDurationVital).toHaveBeenCalledWith('workflow_execution', {
      startTime: performance.timeOrigin + 42,
      duration: 100,
      context: {
        api_node_count: 1,
        custom_node_count: 3,
        executable_node_count: 12,
        execution_duration_ms: 50,
        execution_scope: 'full',
        execution_started_at_unix_ms: performance.timeOrigin + 92,
        failure_reason: '',
        origin_view_id: 'view-a',
        product: 'cloud_generation',
        queue_wait_duration_ms: 30,
        submission_accepted_at_unix_ms: performance.timeOrigin + 62,
        submission_duration_ms: 20,
        subgraph_count: 2,
        success: true,
        terminal_stage: 'execution',
        total_node_count: 42,
        view_mode: 'graph',
        workflow_ended_at_unix_ms: performance.timeOrigin + 142,
        workflow_started_at_unix_ms: performance.timeOrigin + 42,
        workflow_type: 'custom'
      }
    })
  })

  it.for([
    {
      name: 'submission',
      metadata: {
        startTime: 42,
        endTime: 62,
        success: false,
        failureReason: 'submission_rejected'
      },
      duration: 20,
      context: {
        success: false,
        failure_reason: 'submission_rejected',
        terminal_stage: 'submission',
        workflow_started_at_unix_ms: performance.timeOrigin + 42,
        workflow_ended_at_unix_ms: performance.timeOrigin + 62,
        submission_duration_ms: 20,
        product: 'cloud_generation'
      }
    },
    {
      name: 'queue wait',
      metadata: {
        startTime: 42,
        submissionAcceptedAt: 62,
        endTime: 82,
        success: false,
        failureReason: 'execution_failed'
      },
      duration: 40,
      context: {
        success: false,
        failure_reason: 'execution_failed',
        terminal_stage: 'queue_wait',
        workflow_started_at_unix_ms: performance.timeOrigin + 42,
        submission_accepted_at_unix_ms: performance.timeOrigin + 62,
        workflow_ended_at_unix_ms: performance.timeOrigin + 82,
        submission_duration_ms: 20,
        queue_wait_duration_ms: 20,
        product: 'cloud_generation'
      }
    },
    {
      name: 'execution',
      metadata: {
        startTime: 42,
        submissionAcceptedAt: 62,
        executionStartedAt: 92,
        endTime: 142,
        success: false,
        failureReason: 'execution_failed'
      },
      duration: 100,
      context: {
        success: false,
        failure_reason: 'execution_failed',
        terminal_stage: 'execution',
        workflow_started_at_unix_ms: performance.timeOrigin + 42,
        submission_accepted_at_unix_ms: performance.timeOrigin + 62,
        execution_started_at_unix_ms: performance.timeOrigin + 92,
        workflow_ended_at_unix_ms: performance.timeOrigin + 142,
        submission_duration_ms: 20,
        queue_wait_duration_ms: 30,
        execution_duration_ms: 50,
        product: 'cloud_generation'
      }
    }
  ] as const)(
    'records a failed workflow vital ending during $name',
    ({ metadata, duration, context }) => {
      getInternalContext.mockReturnValue(undefined)

      new DatadogRumTelemetryProvider().trackExecutionOutcome(metadata)

      expect(addDurationVital).toHaveBeenCalledWith('workflow_execution', {
        startTime: performance.timeOrigin + 42,
        duration,
        context
      })
    }
  )
})
