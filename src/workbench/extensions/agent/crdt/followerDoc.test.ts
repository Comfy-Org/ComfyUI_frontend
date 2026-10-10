import { mint } from '@comfyorg/comfy-multi-player'
import { describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { reportError } from '@/platform/telemetry/reportError'

import { FollowerDoc } from './followerDoc'

vi.mock(import('@/platform/telemetry/reportError'))

describe('FollowerDoc.applyRemoteUpdate', () => {
  it('applies a valid host update', () => {
    const host = new Y.Doc()
    host.getMap('nodes').set('1', { type: 'LoadImage' })
    const update = Y.encodeStateAsUpdate(host)
    const follower = new FollowerDoc()
    const onUpdate = vi.fn()
    follower.addEventListener('update', onUpdate)

    follower.applyRemoteUpdate(update)

    expect(follower.doc.getMap('nodes').toJSON()).toEqual({
      '1': { type: 'LoadImage' }
    })
    expect(follower.updatesApplied).toBe(1)
    expect(onUpdate).toHaveBeenCalledOnce()
  })

  it('throws for a truncated update without dispatching an event or incrementing updatesApplied', () => {
    const follower = new FollowerDoc()
    const onUpdate = vi.fn()
    follower.addEventListener('update', onUpdate)

    expect(() => follower.applyRemoteUpdate(Uint8Array.of(0))).toThrow(
      'Unexpected end of array'
    )

    expect(onUpdate).not.toHaveBeenCalled()
    expect(follower.updatesApplied).toBe(0)
  })
})

describe('FollowerDoc.lamportFloor', () => {
  it('reports a malformed stamp ledger once and reads it as 0', () => {
    const host = mint({ nodes: [], links: [] }, { types: {} })
    host.getMap('__stamps').set('bogus', 'not a stamp')
    const follower = new FollowerDoc()
    follower.applyRemoteUpdate(Y.encodeStateAsUpdate(host))

    expect(follower.lamportFloor()).toBe(0)
    expect(follower.lamportFloor()).toBe(0)
    expect(reportError).toHaveBeenCalledOnce()
    expect(vi.mocked(reportError).mock.calls[0][1]).toMatchObject({
      errorType: 'failure_reading_agent_crdt_lamport_floor'
    })
  })
})
