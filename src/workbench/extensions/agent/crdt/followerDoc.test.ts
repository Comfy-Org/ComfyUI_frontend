import { describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { FollowerDoc } from './followerDoc'

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

  it('propagates a malformed Yjs update without recording it', () => {
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
