import type { RequestStatus } from '@comfyorg/magic-patch-types'
import { describe, expect, it } from 'vitest'

import type { MagicPatchPollState } from './magicPatchPollState'
import { reduceMagicPatchPoll as reduce } from './magicPatchPollState'

const request: RequestStatus = {
  id: 'a'.repeat(32),
  operation_id: 'b'.repeat(32),
  state: 'waiting_conversion',
  operation_status: 'queued',
  status_version: 1
}
const enabled = () =>
  reduce(
    { phase: 'disabled' },
    { type: 'enabled', scope: 'account/workspace/generation1' }
  )
const scope = 'account/workspace/generation1'

function start(state: MagicPatchPollState, scan = 'cycle1') {
  return reduce(state, { type: 'poll_started', scope, scan })
}

describe('Magic Patch polling projection', () => {
  it('rejects stale scope and previous polling-cycle responses', () => {
    const old = start(enabled())
    const changed = reduce(old, {
      type: 'scope_changed',
      scope: 'account/workspace/generation2'
    })
    expect(
      reduce(changed, {
        type: 'page_received',
        scope,
        scan: 'cycle1',
        page: { requests: [request] }
      })
    ).toBe(changed)
    const restarted = start(old, 'cycle2')
    expect(
      reduce(restarted, {
        type: 'page_received',
        scope,
        scan: 'cycle1',
        page: { requests: [request] }
      })
    ).toBe(restarted)
  })

  it('finishes all pages before replacing the projection and rejects downgrades', () => {
    const done = {
      ...request,
      operation_status: 'completed' as const,
      status_version: 3
    }
    const previous = reduce(start(enabled()), {
      type: 'page_received',
      scope,
      scan: 'cycle1',
      page: { requests: [done] }
    })
    const incomplete = reduce(start(previous, 'cycle2'), {
      type: 'page_received',
      scope,
      scan: 'cycle2',
      page: { requests: [request], next_cursor: 'next' }
    })
    expect(incomplete.phase).toBe('polling')
    const final = reduce(incomplete, {
      type: 'page_received',
      scope,
      scan: 'cycle2',
      page: { requests: [] }
    })
    expect(final).toMatchObject({
      phase: 'idle',
      requests: { [request.id]: done }
    })
  })

  it('fails a repeating cursor or silently replaced operation while retaining known state', () => {
    const first = reduce(start(enabled()), {
      type: 'page_received',
      scope,
      scan: 'cycle1',
      page: { requests: [request], next_cursor: 'same' }
    })
    expect(
      reduce(first, {
        type: 'page_received',
        scope,
        scan: 'cycle1',
        page: { requests: [], next_cursor: 'same' }
      }).phase
    ).toBe('failed')
    const known = reduce(first, {
      type: 'page_received',
      scope,
      scan: 'cycle1',
      page: { requests: [] }
    })
    const changed = reduce(start(known, 'cycle2'), {
      type: 'page_received',
      scope,
      scan: 'cycle2',
      page: {
        requests: [
          { ...request, operation_id: 'c'.repeat(32), status_version: 4 }
        ]
      }
    })
    expect(changed).toMatchObject({
      phase: 'failed',
      requests: { [request.id]: request }
    })
  })

  it('clears acknowledged intents only after a complete successful cycle', () => {
    const known = reduce(start(enabled()), {
      type: 'page_received',
      scope,
      scan: 'cycle1',
      page: { requests: [request] }
    })
    const failed = reduce(start(known, 'cycle2'), {
      type: 'poll_failed',
      scope,
      scan: 'cycle2'
    })
    expect(failed).toMatchObject({
      phase: 'failed',
      requests: { [request.id]: request }
    })
    expect(
      reduce(start(failed, 'cycle3'), {
        type: 'page_received',
        scope,
        scan: 'cycle3',
        page: { requests: [] }
      })
    ).toMatchObject({ phase: 'idle', requests: {} })
  })
})
