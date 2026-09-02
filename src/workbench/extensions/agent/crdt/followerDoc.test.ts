/**
 * FEC-2 — `Y.applyUpdate` is guarded so a malformed/corrupt remote update
 * fails closed (typed `FollowerApplyError`) instead of throwing uncaught out
 * of the caller. See `layoutFollowerBridge.ts`'s `onDocUpdate` for the
 * catch/report/drop consumer of this contract.
 */
import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'

import { FollowerApplyError, FollowerDoc } from './followerDoc'

function validHostUpdate(): Uint8Array {
  const doc = new Y.Doc()
  doc.getMap('nodes').set('1', { type: 'LoadImage' })
  return Y.encodeStateAsUpdate(doc)
}

describe('FollowerDoc.applyRemoteUpdate', () => {
  it('applies a valid update, increments the counter, and dispatches update', () => {
    const follower = new FollowerDoc()
    const events: unknown[] = []
    follower.addEventListener('update', (event) => {
      if (event instanceof CustomEvent) events.push(event.detail)
    })

    follower.applyRemoteUpdate(validHostUpdate())

    expect(follower.updatesApplied).toBe(1)
    expect(events).toHaveLength(1)
    expect(follower.doc.getMap('nodes').get('1')).toEqual({
      type: 'LoadImage'
    })
  })

  it('throws a typed FollowerApplyError on malformed bytes, not the raw Yjs error', () => {
    const follower = new FollowerDoc()

    expect(() => {
      follower.applyRemoteUpdate(new Uint8Array([1, 2, 3, 4, 5]))
    }).toThrow(FollowerApplyError)
  })

  it('leaves updatesApplied and the doc untouched, and dispatches no event, on a rejected update', () => {
    const follower = new FollowerDoc()
    const events: unknown[] = []
    follower.addEventListener('update', (event) => {
      if (event instanceof CustomEvent) events.push(event.detail)
    })

    expect(() => {
      follower.applyRemoteUpdate(new Uint8Array([1, 2, 3, 4, 5]))
    }).toThrow()

    expect(follower.updatesApplied).toBe(0)
    expect(events).toHaveLength(0)
    expect(follower.doc.getMap('nodes').size).toBe(0)
  })

  it('still applies a later valid update after a rejected one (one bad frame, not a poisoned doc)', () => {
    const follower = new FollowerDoc()

    expect(() => {
      follower.applyRemoteUpdate(new Uint8Array([1, 2, 3, 4, 5]))
    }).toThrow(FollowerApplyError)

    follower.applyRemoteUpdate(validHostUpdate())

    expect(follower.updatesApplied).toBe(1)
    expect(follower.doc.getMap('nodes').get('1')).toEqual({
      type: 'LoadImage'
    })
  })
})
