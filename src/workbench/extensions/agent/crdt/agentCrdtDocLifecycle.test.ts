import { beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'

import {
  AgentCrdtDocLifecycle,
  STALE_AFTER_MS,
  SUBSCRIBE_ACK_TIMEOUT_MS
} from './agentCrdtDocLifecycle'
import { recordDevEvent } from './devPanelLog'

vi.mock(import('./devPanelLog'), () => ({ recordDevEvent: vi.fn() }))
vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn<typeof reportError>()
}))

const WORKFLOW_ID = 'wf-1'
const GAVE_UP_REPORT = {
  errorType: 'failure_confirming_agent_doc_subscribe',
  level: 'warning',
  tags: { feature_area: 'agent', operation: 'sync', outcome: 'gave_up' }
}

/**
 * The `resubscribe` double models the bridge: a successful send re-dispatches
 * `doc_subscribe_sent`, which the composable routes back into the lifecycle.
 */
function wire() {
  let workflowId: string | null = WORKFLOW_ID
  const onGaveUp = vi.fn()
  const resubscribe = vi.fn(() => {
    if (workflowId !== null) lifecycle.onSubscribeSent(workflowId)
  })
  const lifecycle = new AgentCrdtDocLifecycle(
    () => workflowId,
    resubscribe,
    onGaveUp
  )
  return {
    lifecycle,
    resubscribe,
    onGaveUp,
    retarget(next: string | null) {
      workflowId = next
    }
  }
}

function devEvents(): { kind: string; detail: unknown }[] {
  return vi
    .mocked(recordDevEvent)
    .mock.calls.map(([kind, detail]) => ({ kind, detail }))
}

describe('AgentCrdtDocLifecycle ack timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('retries an unanswered subscribe exactly at the ack timeout', () => {
    const { lifecycle, resubscribe } = wire()
    lifecycle.onSubscribeSent(WORKFLOW_ID)

    vi.advanceTimersByTime(SUBSCRIBE_ACK_TIMEOUT_MS - 1)
    expect(resubscribe).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(resubscribe).toHaveBeenCalledTimes(1)
    expect(devEvents()).toEqual([
      {
        kind: 'subscribe_ack_timeout',
        detail: { attempt: 1, workflowId: WORKFLOW_ID }
      }
    ])
  })

  it('a confirm disarms the ack timer and hands the channel to the recency probe', () => {
    const { lifecycle, resubscribe } = wire()
    lifecycle.onSubscribeSent(WORKFLOW_ID)
    vi.advanceTimersByTime(1000)
    lifecycle.onSubscribeConfirmed()

    vi.advanceTimersByTime(STALE_AFTER_MS - 1)
    expect(resubscribe).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(resubscribe).toHaveBeenCalledTimes(1)
    expect(devEvents()).toEqual([
      { kind: 'stale_probe', detail: { workflowId: WORKFLOW_ID } }
    ])
  })

  it('a refusal disarms the ack timer and hands off to the refusal backoff', () => {
    const { lifecycle, resubscribe } = wire()
    lifecycle.onSubscribeSent(WORKFLOW_ID)
    lifecycle.onSubscribeRefused()

    vi.advanceTimersByTime(499)
    expect(resubscribe).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(resubscribe).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(SUBSCRIBE_ACK_TIMEOUT_MS - 1)
    expect(resubscribe).toHaveBeenCalledTimes(1)
    expect(devEvents()).toEqual([
      {
        kind: 'subscribe_retry',
        detail: { attempt: 1, workflowId: WORKFLOW_ID }
      }
    ])
  })

  it('gives up on the third unanswered attempt and reports it once', () => {
    const { lifecycle, resubscribe, onGaveUp } = wire()
    lifecycle.onSubscribeSent(WORKFLOW_ID)

    vi.advanceTimersByTime(3 * SUBSCRIBE_ACK_TIMEOUT_MS)

    expect(resubscribe).toHaveBeenCalledTimes(2)
    expect(onGaveUp).toHaveBeenCalledTimes(1)
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      expect.any(Error),
      GAVE_UP_REPORT
    )
    expect(devEvents()).toEqual([
      {
        kind: 'subscribe_ack_timeout',
        detail: { attempt: 1, workflowId: WORKFLOW_ID }
      },
      {
        kind: 'subscribe_ack_timeout',
        detail: { attempt: 2, workflowId: WORKFLOW_ID }
      },
      {
        kind: 'subscribe_ack_timeout',
        detail: { attempt: 2, workflowId: WORKFLOW_ID, terminal: true }
      }
    ])

    vi.advanceTimersByTime(3 * SUBSCRIBE_ACK_TIMEOUT_MS)
    expect(resubscribe).toHaveBeenCalledTimes(2)
    expect(onGaveUp).toHaveBeenCalledTimes(1)
  })

  it('after giving up, neither the recency probe nor a status-frame send resubscribes', () => {
    const { lifecycle, resubscribe, onGaveUp } = wire()
    lifecycle.onSubscribeConfirmed()
    lifecycle.onSubscribeSent(WORKFLOW_ID)
    vi.advanceTimersByTime(3 * SUBSCRIBE_ACK_TIMEOUT_MS)
    expect(resubscribe).toHaveBeenCalledTimes(2)

    lifecycle.onSubscribeSent(WORKFLOW_ID)
    vi.advanceTimersByTime(3 * STALE_AFTER_MS)

    expect(resubscribe).toHaveBeenCalledTimes(2)
    expect(onGaveUp).toHaveBeenCalledTimes(1)
    expect(reportError).toHaveBeenCalledTimes(1)
    expect(devEvents().map(({ kind }) => kind)).not.toContain('stale_probe')
  })

  it('a reconnect resets the silent-attempt budget', () => {
    const { lifecycle, resubscribe, onGaveUp } = wire()
    lifecycle.onSubscribeSent(WORKFLOW_ID)
    vi.advanceTimersByTime(2 * SUBSCRIBE_ACK_TIMEOUT_MS)
    expect(resubscribe).toHaveBeenCalledTimes(2)

    lifecycle.onReconnected()
    lifecycle.onSubscribeSent(WORKFLOW_ID)
    vi.advanceTimersByTime(2 * SUBSCRIBE_ACK_TIMEOUT_MS)

    expect(resubscribe).toHaveBeenCalledTimes(4)
    expect(onGaveUp).not.toHaveBeenCalled()

    vi.advanceTimersByTime(SUBSCRIBE_ACK_TIMEOUT_MS)
    expect(resubscribe).toHaveBeenCalledTimes(4)
    expect(onGaveUp).toHaveBeenCalledTimes(1)
  })

  it('a reconnect cancels a pending refusal backoff', () => {
    const { lifecycle, resubscribe } = wire()
    lifecycle.onSubscribeSent(WORKFLOW_ID)
    lifecycle.onSubscribeRefused()

    lifecycle.onReconnected()
    vi.advanceTimersByTime(SUBSCRIBE_ACK_TIMEOUT_MS)

    expect(resubscribe).not.toHaveBeenCalled()
  })

  it('a reconnect releases the give-up latch', () => {
    const { lifecycle, resubscribe, onGaveUp } = wire()
    lifecycle.onSubscribeSent(WORKFLOW_ID)
    vi.advanceTimersByTime(3 * SUBSCRIBE_ACK_TIMEOUT_MS)
    expect(onGaveUp).toHaveBeenCalledTimes(1)

    lifecycle.onReconnected()
    lifecycle.onSubscribeSent(WORKFLOW_ID)
    vi.advanceTimersByTime(SUBSCRIBE_ACK_TIMEOUT_MS)

    expect(resubscribe).toHaveBeenCalledTimes(3)
  })

  it('a second send before expiry re-arms the timer without spending an attempt', () => {
    const { lifecycle, resubscribe } = wire()
    lifecycle.onSubscribeSent(WORKFLOW_ID)
    vi.advanceTimersByTime(SUBSCRIBE_ACK_TIMEOUT_MS - 1)

    lifecycle.onSubscribeSent(WORKFLOW_ID)
    vi.advanceTimersByTime(1)
    expect(resubscribe).not.toHaveBeenCalled()

    vi.advanceTimersByTime(SUBSCRIBE_ACK_TIMEOUT_MS - 1)
    expect(resubscribe).toHaveBeenCalledTimes(1)
    expect(devEvents()).toEqual([
      {
        kind: 'subscribe_ack_timeout',
        detail: { attempt: 1, workflowId: WORKFLOW_ID }
      }
    ])
  })

  it('an expiry for a workflow that is no longer targeted resubscribes nothing', () => {
    const { lifecycle, resubscribe, retarget } = wire()
    lifecycle.onSubscribeSent(WORKFLOW_ID)
    retarget('wf-2')

    vi.advanceTimersByTime(SUBSCRIBE_ACK_TIMEOUT_MS)

    expect(resubscribe).not.toHaveBeenCalled()
    expect(devEvents()).toEqual([])
  })

  it.for([
    {
      label: 'clearForRetarget',
      cancel: (lifecycle: AgentCrdtDocLifecycle) => lifecycle.clearForRetarget()
    },
    {
      label: 'destroy',
      cancel: (lifecycle: AgentCrdtDocLifecycle) => lifecycle.destroy()
    }
  ])('$label while an ack is pending cancels the timer', ({ cancel }) => {
    const { lifecycle, resubscribe, onGaveUp } = wire()
    lifecycle.onSubscribeSent(WORKFLOW_ID)

    cancel(lifecycle)
    vi.advanceTimersByTime(3 * SUBSCRIBE_ACK_TIMEOUT_MS)

    expect(resubscribe).not.toHaveBeenCalled()
    expect(onGaveUp).not.toHaveBeenCalled()
  })

  it('silence and refusals spend one shared budget', () => {
    const { lifecycle, resubscribe, onGaveUp } = wire()
    lifecycle.onSubscribeSent(WORKFLOW_ID)
    vi.advanceTimersByTime(SUBSCRIBE_ACK_TIMEOUT_MS)
    expect(resubscribe).toHaveBeenCalledTimes(1)

    lifecycle.onSubscribeRefused()
    vi.advanceTimersByTime(1000)
    expect(resubscribe).toHaveBeenCalledTimes(2)

    vi.advanceTimersByTime(2 * SUBSCRIBE_ACK_TIMEOUT_MS)

    expect(resubscribe).toHaveBeenCalledTimes(3)
    expect(onGaveUp).toHaveBeenCalledTimes(1)
    expect(devEvents().at(-1)).toEqual({
      kind: 'subscribe_ack_timeout',
      detail: { attempt: 3, workflowId: WORKFLOW_ID, terminal: true }
    })

    vi.advanceTimersByTime(3 * SUBSCRIBE_ACK_TIMEOUT_MS)
    expect(resubscribe).toHaveBeenCalledTimes(3)
  })
})
