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

  // The Go server omits an empty state and never sends `state: null`; null
  // still counts as absent so the frame keeps actor and expires_at (#16653).
  const rejected = null
  it.for([
    {
      name: 'an absent state',
      kind: 'absent',
      state: undefined,
      expected: withoutState
    },
    {
      name: 'a null state',
      kind: 'absent',
      state: null,
      expected: withoutState
    },
    {
      name: 'a string state',
      kind: 'invalid',
      state: 'cursor',
      expected: rejected
    },
    {
      name: 'an array state',
      kind: 'invalid',
      state: ['cursor', 10, 20],
      expected: rejected
    },
    {
      name: 'a state of exactly 8 KiB',
      kind: 'state',
      state: { value: 'x'.repeat(8 * 1024 - 12) },
      expected: {
        type: 'awareness',
        data: {
          ...withoutState.data,
          state: { value: 'x'.repeat(8 * 1024 - 12) }
        }
      }
    },
    {
      name: 'a state of 8 KiB plus one byte',
      kind: 'invalid',
      state: { value: 'x'.repeat(8 * 1024 - 11) },
      expected: rejected
    },
    {
      name: 'a valid state',
      kind: 'state',
      state: { selection: 'node-1' },
      expected: {
        type: 'awareness',
        data: { ...withoutState.data, state: { selection: 'node-1' } }
      }
    }
  ])('parses $name as $kind', ({ state, expected }) => {
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
