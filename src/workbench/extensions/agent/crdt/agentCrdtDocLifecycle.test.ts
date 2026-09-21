import { beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'

import {
  AgentCrdtDocLifecycle,
  STALE_AFTER_MS,
  SUBSCRIBE_ACK_TIMEOUT_MS,
  SUBSCRIBE_CATCHUP_GRACE_MS
} from './agentCrdtDocLifecycle'
import { recordDevEvent } from './devPanelLog'
import {
  DOC_ID_SESSION_KEY,
  persistDocId,
  reconcilePersistedDocId
} from './persistedDocId'

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
    // A bare resubscribe double (not `wire()`'s auto-chaining one) isolates
    // the catch-up-grace-probe/recency-probe handoff from the ack-timeout
    // retry cascade, which has its own dedicated tests above.
    const resubscribe = vi.fn()
    const lifecycle = new AgentCrdtDocLifecycle(
      () => WORKFLOW_ID,
      resubscribe,
      vi.fn()
    )
    lifecycle.onSubscribeSent(WORKFLOW_ID)
    vi.advanceTimersByTime(1000)
    lifecycle.onSubscribeConfirmed()

    // A confirm arms the catch-up grace probe, not the ack timer it just
    // disarmed (which would otherwise fire at t=15000).
    vi.advanceTimersByTime(SUBSCRIBE_CATCHUP_GRACE_MS - 1)
    expect(resubscribe).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(resubscribe).toHaveBeenCalledTimes(1)
    expect(devEvents()).toEqual([
      { kind: 'catchup_probe', detail: { workflowId: WORKFLOW_ID } }
    ])

    // The grace probe hands off to the full-budget recency probe: the next
    // resubscribe is STALE_AFTER_MS later (confirming the disarmed ack timer
    // never fired at t=15000 either), not another grace interval away.
    vi.advanceTimersByTime(STALE_AFTER_MS - 1)
    expect(resubscribe).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1)
    expect(resubscribe).toHaveBeenCalledTimes(2)
    expect(devEvents().at(-1)).toEqual({
      kind: 'stale_probe',
      detail: { workflowId: WORKFLOW_ID }
    })
  })

  it('PM-1405: an acked-but-contentless resubscribe gets one fast probe per gap, then the full budget', () => {
    // Unlike `wire()`'s bare resubscribe double (which never answers), this
    // mock models Christian's reported backend state: the resubscribe is
    // acknowledged every time but never delivers a doc_update.
    const onGaveUp = vi.fn()
    const resubscribe = vi.fn(() => {
      lifecycle.onSubscribeSent(WORKFLOW_ID)
      lifecycle.onSubscribeConfirmed()
    })
    const lifecycle = new AgentCrdtDocLifecycle(
      () => WORKFLOW_ID,
      resubscribe,
      onGaveUp
    )

    // The initial subscribe also confirms with no catch-up content, arming
    // this gap episode's one fast probe.
    lifecycle.onSubscribeSent(WORKFLOW_ID)
    lifecycle.onSubscribeConfirmed()

    vi.advanceTimersByTime(SUBSCRIBE_CATCHUP_GRACE_MS - 1)
    expect(resubscribe).not.toHaveBeenCalled()

    // The fast probe fires and resubscribes; the ack-without-content comes
    // straight back through the mock.
    vi.advanceTimersByTime(1)
    expect(resubscribe).toHaveBeenCalledTimes(1)

    // Bug: that ack re-armed another SUBSCRIBE_CATCHUP_GRACE_MS probe here,
    // so a second resubscribe would already have fired by this point. Fix:
    // the episode already spent its one fast shot, so this probe waits the
    // full STALE_AFTER_MS instead.
    vi.advanceTimersByTime(STALE_AFTER_MS - 1)
    expect(resubscribe).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1)
    expect(resubscribe).toHaveBeenCalledTimes(2)
    expect(devEvents().map(({ kind }) => kind)).toEqual([
      'catchup_probe',
      'stale_probe'
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

/**
 * FE-1969 regression. This file used to carry its OWN copy of the persisted
 * doc-id record — same `Comfy.Agent.CrdtDocId` key, but a second module-scope
 * page-load nonce. Two owners on one key can never agree: whichever module
 * wrote last left the other's reader looking at a foreign nonce, so
 * `readPersistedDocId()` answered "nothing persisted" for the rest of the page
 * load. On a reload that is exactly the failing path — `useAgentDockMount`
 * reconciles the record through `persistedDocId.ts` and re-stamps it with that
 * module's nonce, then the follower's initial bind asks the lifecycle, gets
 * `null`, clears the record and never resubscribes.
 */
describe('AgentCrdtDocLifecycle persisted doc id', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('reads back a record written through the single persistence owner', () => {
    const { lifecycle } = wire()
    persistDocId(WORKFLOW_ID)

    expect(lifecycle.readPersistedDocId()).toBe(WORKFLOW_ID)
  })

  it('still sees the record after a reload adoption re-stamps its nonce', () => {
    const { lifecycle } = wire()
    // A previous page load's record: right key and shape, foreign nonce.
    sessionStorage.setItem(
      DOC_ID_SESSION_KEY,
      JSON.stringify({
        docId: WORKFLOW_ID,
        nonce: 'the-pre-reload-page-load',
        expiresAt: Date.now() + 60_000
      })
    )
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
      { type: 'reload' } as PerformanceNavigationTiming
    ])
    // What useAgentDockMount does before the follower ever binds.
    expect(reconcilePersistedDocId()).toBe(WORKFLOW_ID)

    expect(lifecycle.readPersistedDocId()).toBe(WORKFLOW_ID)
  })

  it('a confirmed subscribe persists through the same owner', () => {
    const { lifecycle } = wire()
    lifecycle.onSubscribeConfirmed()

    expect(reconcilePersistedDocId()).toBe(WORKFLOW_ID)
  })
})
