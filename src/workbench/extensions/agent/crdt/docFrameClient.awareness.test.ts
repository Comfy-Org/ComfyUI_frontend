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
  const withoutState = {
    type: 'awareness',
    data: { workflowId: 'wf-1', actor: 'human:user:tab-a', expiresAt: 456 }
  }

  // A null state folds into "no state" rather than discarding the whole
  // frame (and with it actor/expires_at). discussion_r3911665011.
  it.for([
    { name: 'an absent state', state: undefined, expected: withoutState },
    { name: 'a null state', state: null, expected: withoutState },
    { name: 'a string state', state: 'cursor', expected: null },
    { name: 'an array state', state: ['cursor', 10, 20], expected: null },
    {
      name: 'a state over 8 KiB',
      state: { value: 'x'.repeat(8 * 1024) },
      expected: null
    },
    {
      name: 'a valid state',
      state: { selection: 'node-1' },
      expected: {
        type: 'awareness',
        data: { ...withoutState.data, state: { selection: 'node-1' } }
      }
    }
  ])('parses $name', ({ state, expected }) => {
    expect(parseServerDocFrame(awarenessFrame(state, 456))).toEqual(expected)
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
