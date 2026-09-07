import { describe, expect, it } from 'vitest'

import { parseServerDocFrame } from './docFrameClient'

function awarenessFrame(state: unknown, expiresAt: unknown = 123) {
  return {
    type: 'awareness',
    data: {
      v: 1,
      workflow_id: 'wf-1',
      actor: 'human:user:tab-a',
      state,
      expires_at: expiresAt
    }
  }
}

describe('awareness frame validation', () => {
  it('rejects state whose JSON encoding exceeds 8 KiB', () => {
    expect(
      parseServerDocFrame(awarenessFrame({ value: 'x'.repeat(8 * 1024) }))
    ).toBeNull()
  })

  it('accepts state whose JSON encoding is exactly 8 KiB', () => {
    // `{"value":"x…"}` wraps the string in 12 bytes of JSON syntax.
    const state = { value: 'x'.repeat(8 * 1024 - 12) }
    expect(new TextEncoder().encode(JSON.stringify(state)).byteLength).toBe(
      8 * 1024
    )
    expect(parseServerDocFrame(awarenessFrame(state))).toMatchObject({
      data: { state }
    })
  })

  it('rejects array-shaped state', () => {
    expect(parseServerDocFrame(awarenessFrame(['cursor', 10, 20]))).toBeNull()
  })

  it('treats a null state as absent rather than rejecting the frame', () => {
    // The Go server's `State map[string]any` has `omitempty` and never
    // actually emits `state: null`, but this is defence in depth: null
    // should fold into "no state", not discard the whole frame (and with
    // it actor/expires_at). discussion_r3911665011.
    expect(parseServerDocFrame(awarenessFrame(null, 456))).toEqual({
      type: 'awareness',
      data: {
        workflowId: 'wf-1',
        actor: 'human:user:tab-a',
        expiresAt: 456
      }
    })
  })

  it('rejects negative expires_at', () => {
    expect(parseServerDocFrame(awarenessFrame({}, -1))).toBeNull()
  })

  it('rejects non-finite expires_at', () => {
    expect(
      parseServerDocFrame(awarenessFrame({}, Number.POSITIVE_INFINITY))
    ).toBeNull()
    expect(parseServerDocFrame(awarenessFrame({}, Number.NaN))).toBeNull()
  })

  it('rejects fractional expires_at', () => {
    expect(parseServerDocFrame(awarenessFrame({}, 1.5))).toBeNull()
  })

  it('rejects expires_at beyond the safe integer range', () => {
    expect(
      parseServerDocFrame(awarenessFrame({}, Number.MAX_SAFE_INTEGER + 1))
    ).toBeNull()
    expect(parseServerDocFrame(awarenessFrame({}, 1e300))).toBeNull()
  })

  it('accepts a zero expires_at', () => {
    expect(parseServerDocFrame(awarenessFrame({}, 0))).toMatchObject({
      data: { expiresAt: 0 }
    })
  })

  it('accepts a valid awareness frame', () => {
    expect(
      parseServerDocFrame(
        awarenessFrame({ cursor: [10, 20], selection: 'node-1' }, 456)
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
