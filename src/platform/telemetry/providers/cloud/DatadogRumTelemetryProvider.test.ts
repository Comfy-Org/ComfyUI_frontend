import { afterEach, describe, expect, it, vi } from 'vitest'

import type { BillingTelemetryEvent } from '../../types'
import { TelemetryEvents } from '../../types'
import { DatadogRumTelemetryProvider } from './DatadogRumTelemetryProvider'

const { addAction, addDurationVital, getInternalContext } = vi.hoisted(() => ({
  addAction: vi.fn(),
  addDurationVital: vi.fn(),
  getInternalContext: vi.fn()
}))

vi.mock('@datadog/browser-rum', () => ({
  datadogRum: { addAction, addDurationVital, getInternalContext }
}))

const workflowExecutionIntent = {
  trigger_source: 'keybinding'
} as const

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('DatadogRumTelemetryProvider', () => {
  it('records the same canonical billing name and context as PostHog', () => {
    const event: BillingTelemetryEvent = {
      operation: 'operation',
      stage: 'failed',
      outcome: 'failure',
      billing_op_id: 'opaque-op-id',
      operation_type: 'subscription',
      tier: 'pro',
      cycle: 'monthly',
      checkout_type: 'new',
      payment_intent_source: 'subscribe_to_run',
      failure_category: 'provider_decline'
    }

    new DatadogRumTelemetryProvider().trackBillingEvent(event)

    expect(addAction).toHaveBeenCalledExactlyOnceWith(
      TelemetryEvents.BILLING_OPERATION_FAILED,
      event
    )
  })

  it('drops fields outside the billing telemetry contract', () => {
    const event = {
      operation: 'topup',
      stage: 'failed',
      outcome: 'failure',
      billing_op_id: 'opaque-op-id',
      failure_category: 'unknown',
      error_message: 'raw provider response',
      email: 'user@example.com'
    } satisfies BillingTelemetryEvent & {
      error_message: string
      email: string
    }

    new DatadogRumTelemetryProvider().trackBillingEvent(event)

    expect(addAction).toHaveBeenCalledExactlyOnceWith(
      TelemetryEvents.BILLING_TOPUP_FAILED,
      {
        operation: 'topup',
        stage: 'failed',
        outcome: 'failure',
        billing_op_id: 'opaque-op-id',
        failure_category: 'unknown'
      }
    )
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
      ...workflowExecutionIntent,
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
        queue_wait_duration_ms: 30,
        submission_accepted_at_unix_ms: performance.timeOrigin + 62,
        submission_duration_ms: 20,
        subgraph_count: 2,
        success: true,
        terminal_stage: 'execution',
        total_node_count: 42,
        trigger_source: 'keybinding',
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
        failureReason: 'submission_rejected',
        ...workflowExecutionIntent
      },
      duration: 20,
      context: {
        success: false,
        failure_reason: 'submission_rejected',
        terminal_stage: 'submission',
        workflow_started_at_unix_ms: performance.timeOrigin + 42,
        workflow_ended_at_unix_ms: performance.timeOrigin + 62,
        submission_duration_ms: 20,
        trigger_source: 'keybinding'
      }
    },
    {
      name: 'queue wait',
      metadata: {
        startTime: 42,
        submissionAcceptedAt: 62,
        endTime: 82,
        success: false,
        failureReason: 'execution_failed',
        ...workflowExecutionIntent
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
        trigger_source: 'keybinding'
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
        failureReason: 'execution_failed',
        ...workflowExecutionIntent
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
        trigger_source: 'keybinding'
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

  it('keeps stage timestamps monotonic when execution finishes before the submission response', () => {
    getInternalContext.mockReturnValue(undefined)

    new DatadogRumTelemetryProvider().trackExecutionOutcome({
      startTime: 42,
      executionStartedAt: 52,
      submissionAcceptedAt: 62,
      endTime: 58,
      success: false,
      failureReason: 'execution_failed',
      ...workflowExecutionIntent
    })

    expect(addDurationVital).toHaveBeenCalledWith('workflow_execution', {
      startTime: performance.timeOrigin + 42,
      duration: 20,
      context: {
        success: false,
        failure_reason: 'execution_failed',
        terminal_stage: 'execution',
        trigger_source: 'keybinding',
        workflow_started_at_unix_ms: performance.timeOrigin + 42,
        submission_accepted_at_unix_ms: performance.timeOrigin + 62,
        execution_started_at_unix_ms: performance.timeOrigin + 62,
        workflow_ended_at_unix_ms: performance.timeOrigin + 62,
        submission_duration_ms: 20,
        queue_wait_duration_ms: 0,
        execution_duration_ms: 0
      }
    })
  })
})
