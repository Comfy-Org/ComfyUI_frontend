/**
 * The subscribe-retry budget as the follower observes it. The FE-1901 backoff
 * itself is covered from the composable (useAgentCrdtFollower.test.ts); this
 * suite pins the one thing the composable cannot see through a void call:
 * whether a refusal still has a retry behind it, or was the last word.
 */
import { describe, expect, it, vi } from 'vitest'

import {
  AgentCrdtDocLifecycle,
  SUBSCRIBE_RETRY_MAX_ATTEMPTS
} from './agentCrdtDocLifecycle'

vi.mock(import('./devPanelLog'), () => ({ recordDevEvent: vi.fn() }))

function lifecycle(workflowId: () => string | null = () => 'wf-1') {
  const resubscribe = vi.fn()
  return {
    lifecycle: new AgentCrdtDocLifecycle(workflowId, resubscribe),
    resubscribe
  }
}

/** Refuse, let the scheduled retry fire, until the whole budget is spent. */
function spendRetryBudget(target: AgentCrdtDocLifecycle): void {
  for (let attempt = 0; attempt < SUBSCRIBE_RETRY_MAX_ATTEMPTS; attempt++) {
    expect(target.onSubscribeRefused()).toBe('retrying')
    vi.runOnlyPendingTimers()
  }
}

describe('AgentCrdtDocLifecycle subscribe retry budget', () => {
  it('reports every budgeted refusal as retrying, and the one after as exhausted', () => {
    vi.useFakeTimers()
    const { lifecycle: target, resubscribe } = lifecycle()

    spendRetryBudget(target)
    expect(resubscribe).toHaveBeenCalledTimes(SUBSCRIBE_RETRY_MAX_ATTEMPTS)

    expect(target.onSubscribeRefused()).toBe('exhausted')
    expect(target.hasPendingSubscribeRetry()).toBe(false)
    vi.advanceTimersByTime(60_000)
    expect(resubscribe).toHaveBeenCalledTimes(SUBSCRIBE_RETRY_MAX_ATTEMPTS)
  })

  it('a refusal while a retry is already pending is still retrying, not a second attempt', () => {
    vi.useFakeTimers()
    const { lifecycle: target, resubscribe } = lifecycle()

    expect(target.onSubscribeRefused()).toBe('retrying')
    expect(target.onSubscribeRefused()).toBe('retrying')
    vi.runOnlyPendingTimers()

    expect(resubscribe).toHaveBeenCalledTimes(1)
  })

  it('a confirmed subscribe restores the budget', () => {
    vi.useFakeTimers()
    const { lifecycle: target } = lifecycle()
    spendRetryBudget(target)
    expect(target.onSubscribeRefused()).toBe('exhausted')

    target.onSubscribeConfirmed()

    expect(target.onSubscribeRefused()).toBe('retrying')
  })

  it('a retarget restores the budget', () => {
    vi.useFakeTimers()
    const { lifecycle: target } = lifecycle()
    spendRetryBudget(target)
    expect(target.onSubscribeRefused()).toBe('exhausted')

    target.clearForRetarget()

    expect(target.onSubscribeRefused()).toBe('retrying')
  })

  it('a refusal with nothing bound has nothing to retry', () => {
    vi.useFakeTimers()
    const { lifecycle: target, resubscribe } = lifecycle(() => null)

    expect(target.onSubscribeRefused()).toBe('exhausted')
    vi.advanceTimersByTime(60_000)
    expect(resubscribe).not.toHaveBeenCalled()
  })
})
