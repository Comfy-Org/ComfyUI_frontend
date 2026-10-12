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
  it.for([
    {
      name: 'keeps the frame without a state when state is missing',
      state: undefined,
      expected: {
        type: 'awareness',
        data: { workflowId: 'wf-1', actor: 'human:user:tab-a', expiresAt: 456 }
      }
    },
    // The Go server omits an empty state and never sends `state: null`; null
    // still counts as absent so the frame keeps actor and expires_at (#16653).
    {
      name: 'keeps the frame without a state when state is null',
      state: null,
      expected: {
        type: 'awareness',
        data: { workflowId: 'wf-1', actor: 'human:user:tab-a', expiresAt: 456 }
      }
    },
    { name: 'rejects a string state', state: 'cursor', expected: null },
    {
      name: 'rejects an array state',
      state: ['cursor', 10, 20],
      expected: null
    },
    // `{"value":"x…"}` wraps the string in 12 bytes of JSON syntax.
    {
      name: 'accepts a state whose JSON is exactly 8 KiB',
      state: { value: 'x'.repeat(8 * 1024 - 12) },
      expected: {
        type: 'awareness',
        data: {
          workflowId: 'wf-1',
          actor: 'human:user:tab-a',
          state: { value: 'x'.repeat(8 * 1024 - 12) },
          expiresAt: 456
        }
      }
    },
    {
      name: 'rejects a state whose JSON is 8 KiB plus one byte',
      state: { value: 'x'.repeat(8 * 1024 - 11) },
      expected: null
    },
    {
      name: 'passes a valid state through',
      state: { cursor: [10, 20], selection: 'node-1' },
      expected: {
        type: 'awareness',
        data: {
          workflowId: 'wf-1',
          actor: 'human:user:tab-a',
          state: { cursor: [10, 20], selection: 'node-1' },
          expiresAt: 456
        }
      }
    }
  ])('$name', ({ state, expected }) => {
    expect(parseServerDocFrame(awarenessFrame(state, 456))).toEqual(expected)
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
})
