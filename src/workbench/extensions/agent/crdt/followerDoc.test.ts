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
  const seeded = (configure: (host: Y.Doc) => void): FollowerDoc => {
    const host = mint({ nodes: [], links: [] }, { types: {} })
    configure(host)
    const follower = new FollowerDoc()
    follower.applyRemoteUpdate(Y.encodeStateAsUpdate(host))
    return follower
  }

  it('takes the highest valid stamp when one row is malformed, and reports once', () => {
    const follower = seeded((host) => {
      host
        .getMap('__stamps')
        .set('["widget","1","0","seed"]', [12, 'agent:t', 'a'.repeat(32)])
      host.getMap('__stamps').set('bogus', 'not a stamp')
    })

    expect(follower.lamportFloor()).toBe(12)
    expect(follower.lamportFloor()).toBe(12)
    expect(reportError).toHaveBeenCalledOnce()
    expect(vi.mocked(reportError).mock.calls[0][1]).toMatchObject({
      errorType: 'failure_reading_agent_crdt_lamport_floor',
      context: { skippedRows: 1 }
    })
  })

  it('keeps a counter it observed after the ledger drops that row', () => {
    const host = mint({ nodes: [], links: [] }, { types: {} })
    const key = '["widget","1","0","seed"]'
    host.getMap('__stamps').set(key, [50, 'human:other:tab', 'a'.repeat(32)])
    const follower = new FollowerDoc()
    follower.applyRemoteUpdate(Y.encodeStateAsUpdate(host))
    const seen = Y.encodeStateVector(host)
    host.getMap('__stamps').delete(key)
    follower.applyRemoteUpdate(Y.encodeStateAsUpdate(host, seen))

    expect(follower.doc.getMap('__stamps').has(key)).toBe(false)
    expect(follower.lamportFloor()).toBe(50)
  })

  it('reads 0 without reporting on a doc no frame has seeded or of another schema', () => {
    expect(new FollowerDoc().lamportFloor()).toBe(0)
    const other = seeded((host) =>
      host.getMap('meta').set('schema_version', 999)
    )

    expect(other.lamportFloor()).toBe(0)
    expect(reportError).not.toHaveBeenCalled()
  })
})
