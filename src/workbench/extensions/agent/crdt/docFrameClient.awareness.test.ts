import { describe, expect, it } from 'vitest'

import { awarenessFrame } from './__fixtures__/docFrameClient'
import { parseServerDocFrame } from './docFrameClient'

const invalidAwarenessFrames: [string, unknown, unknown][] = [
  ['an oversized state', { value: 'x'.repeat(8 * 1024) }, 123],
  ['an array state', ['cursor', 10, 20], 123],
  ['a negative expiry', {}, -1],
  ['an infinite expiry', {}, Number.POSITIVE_INFINITY],
  ['a NaN expiry', {}, Number.NaN],
  ['a fractional expiry', {}, 1.5],
  ['an unsafe expiry', {}, Number.MAX_SAFE_INTEGER + 1],
  ['an extremely large expiry', {}, 1e300],
  ['an unserializable state', { value: 1n }, 123]
]

describe('awareness frame validation', () => {
  it.for(invalidAwarenessFrames)('rejects %s', ([_name, state, expiresAt]) => {
    expect(
      parseServerDocFrame(awarenessFrame({ state, expires_at: expiresAt }))
    ).toBeNull()
  })

  it('accepts state whose JSON encoding is exactly 8 KiB', () => {
    const state = { value: 'x'.repeat(8 * 1024 - 12) }
    expect(new TextEncoder().encode(JSON.stringify(state)).byteLength).toBe(
      8 * 1024
    )
    expect(parseServerDocFrame(awarenessFrame({ state }))).toMatchObject({
      data: { state }
    })
  })

  it('treats a null state as absent rather than rejecting the frame', () => {
    // The Go server's `State map[string]any` has `omitempty` and never
    // actually emits `state: null`, but this is defence in depth: null
    // should fold into "no state", not discard the whole frame (and with
    // it actor/expires_at). discussion_r3911665011.
    expect(
      parseServerDocFrame(awarenessFrame({ state: null, expires_at: 456 }))
    ).toEqual({
      type: 'awareness',
      data: {
        workflowId: 'wf-1',
        actor: 'human:user:tab-a',
        expiresAt: 456
      }
    })
  })

  it('accepts a zero expires_at', () => {
    expect(
      parseServerDocFrame(awarenessFrame({ expires_at: 0 }))
    ).toMatchObject({
      data: { expiresAt: 0 }
    })
  })

  it('accepts a valid awareness frame', () => {
    expect(
      parseServerDocFrame(
        awarenessFrame({
          state: { cursor: [10, 20], selection: 'node-1' },
          expires_at: 456
        })
      )
    ).toEqual({
      type: 'awareness',
      data: {
        workflowId: 'wf-1',
        actor: 'human:user:tab-a',
        state: { cursor: [10, 20], selection: 'node-1' },
        expiresAt: 456
      }
    })
  })
})
