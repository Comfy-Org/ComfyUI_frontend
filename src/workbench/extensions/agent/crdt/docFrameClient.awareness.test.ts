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

  it('rejects array-shaped state', () => {
    expect(parseServerDocFrame(awarenessFrame(['cursor', 10, 20]))).toBeNull()
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
