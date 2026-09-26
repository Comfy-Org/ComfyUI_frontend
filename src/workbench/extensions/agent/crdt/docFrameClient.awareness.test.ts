import { beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'

import type { DocFrameTransport } from './docFrameClient'
import { DocFrameClient, parseServerDocFrame } from './docFrameClient'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

beforeEach(() => {
  vi.mocked(reportError).mockClear()
})

class TestTransport extends EventTarget implements DocFrameTransport {
  readonly sent: string[] = []

  send(frame: string): boolean {
    this.sent.push(frame)
    return true
  }
}

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

  it('refuses to send awareness with an invalid actor or oversized state', () => {
    const transport = new TestTransport()
    const client = new DocFrameClient(transport)

    expect(client.sendAwareness('wf-1', 'not-an-actor', {})).toBe(false)
    expect(
      client.sendAwareness('wf-1', 'human:user:tab-a', {
        value: 'x'.repeat(8 * 1024)
      })
    ).toBe(false)
    expect(transport.sent).toHaveLength(0)
  })

  it('refuses to send awareness with an invalid workflow id', () => {
    const transport = new TestTransport()
    const client = new DocFrameClient(transport)

    expect(client.sendAwareness('', 'human:user:tab-a')).toBe(false)
    expect(client.sendAwareness('wf 1', 'human:user:tab-a')).toBe(false)
    expect(client.sendAwareness('wf:1', 'human:user:tab-a')).toBe(false)
    expect(transport.sent).toHaveLength(0)
  })

  it('refuses to publish awareness as the reserved system actor', () => {
    const transport = new TestTransport()
    const client = new DocFrameClient(transport)

    expect(
      client.sendAwareness('wf-1', 'system:mint', { cursor: [1, 2] })
    ).toBe(false)
    expect(transport.sent).toHaveLength(0)
  })

  // The contract is a plain object, not merely "not an array". A class
  // instance or Date flattens to something the receiver cannot round-trip
  // into the same shape, so each is refused at the boundary. Every case is a
  // real value, never a cast, so the test cannot pass by lying to the
  // compiler about what was sent.
  it.for([
    ['an array', [1, 2]],
    [
      'a class instance',
      new (class Cursor {
        x = 1
      })()
    ],
    ['a Date', new Date(0)]
  ] as const)('refuses to send awareness state that is %s', ([, state]) => {
    const transport = new TestTransport()
    const client = new DocFrameClient(transport)

    expect(client.sendAwareness('wf-1', 'human:user:tab-a', state)).toBe(false)
    expect(transport.sent).toHaveLength(0)
  })

  it('refuses state whose getter throws, without the error escaping', () => {
    const transport = new TestTransport()
    const client = new DocFrameClient(transport)
    const state = {
      get cursor(): never {
        throw new Error('getter exploded')
      }
    }

    expect(client.sendAwareness('wf-1', 'human:user:tab-a', state)).toBe(false)
    expect(transport.sent).toHaveLength(0)
  })

  it('treats a null state as absent, matching the inbound parser', () => {
    const transport = new TestTransport()
    const client = new DocFrameClient(transport)

    expect(client.sendAwareness('wf-1', 'human:user:tab-a', null)).toBe(true)
    expect(JSON.parse(transport.sent[0]).data).not.toHaveProperty('state')
  })

  it('refuses to send cyclic awareness state without throwing', () => {
    const transport = new TestTransport()
    const client = new DocFrameClient(transport)
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic

    expect(client.sendAwareness('wf-1', 'human:user:tab-a', cyclic)).toBe(false)
    expect(transport.sent).toHaveLength(0)
  })

  it('does not throw when state serializes differently on a second pass', () => {
    const transport = new TestTransport()
    const client = new DocFrameClient(transport)
    let passes = 0
    const state = {
      toJSON() {
        passes += 1
        if (passes >= 2) throw new Error('second serialization pass')
        return { cursor: [1, 2] }
      }
    }

    expect(client.sendAwareness('wf-1', 'human:user:tab-a', state)).toBe(true)
    expect(transport.sent).toHaveLength(1)
  })

  it('sends the exact state that passed the size check', () => {
    const transport = new TestTransport()
    const client = new DocFrameClient(transport)
    const state = {
      toJSON(key: string) {
        return key === 'state' ? 'x'.repeat(9 * 1024) : { cursor: [1, 2] }
      }
    }

    expect(client.sendAwareness('wf-1', 'human:user:tab-a', state)).toBe(true)
    expect(JSON.parse(transport.sent[0]).data.state).toEqual({ cursor: [1, 2] })
  })

  it('rejects state the server would reject after HTML escaping', () => {
    const transport = new TestTransport()
    const client = new DocFrameClient(transport)

    expect(
      client.sendAwareness('wf-1', 'human:user:tab-a', {
        value: '<'.repeat(1400)
      })
    ).toBe(false)
    expect(transport.sent).toHaveLength(0)
  })

  // Derived from Go's rule rather than from the implementation, so the client
  // cannot quietly become stricter than the server: `{"v":""}` is 8 bytes of
  // envelope, Go escapes each `<` to the six bytes of `\u003c`, and the
  // receiver's cap is 8 KiB. 8192 - 8 = 8184, and 8184 / 6 = 1364 exactly, so
  // 1364 is the last accepted count and 1365 is the first rejected one.
  it.for([
    [1364, true],
    [1365, false]
  ] as const)('escaping boundary: %i `<` accepted=%o', ([count, accepted]) => {
    const transport = new TestTransport()
    const client = new DocFrameClient(transport)

    expect(
      client.sendAwareness('wf-1', 'human:user:tab-a', {
        v: '<'.repeat(count)
      })
    ).toBe(accepted)
  })

  // Go escapes U+2028 and U+2029 the same way. They cost three UTF-8 bytes
  // here and six after escaping, so the accepted count is the same 1364 even
  // though the unescaped payload is three times larger.
  it.for([
    ['\u2028', 1364, true],
    ['\u2028', 1365, false],
    ['\u2029', 1365, false]
  ] as const)(
    'escaping boundary: %s x%i accepted=%o',
    ([separator, count, accepted]) => {
      const transport = new TestTransport()
      const client = new DocFrameClient(transport)

      expect(
        client.sendAwareness('wf-1', 'human:user:tab-a', {
          v: separator.repeat(count)
        })
      ).toBe(accepted)
    }
  )

  it('reports each outgoing rejection reason once, not every occurrence', () => {
    const transport = new TestTransport()
    const client = new DocFrameClient(transport)

    // `workflow_id` forbids the frame's delimiters; `actor` must match the
    // grammar. Two distinct ids trigger the same reason twice.
    expect(client.sendAwareness('wf:1', 'human:user:tab-a')).toBe(false)
    expect(client.sendAwareness('wf 2', 'human:user:tab-a')).toBe(false)
    expect(client.sendAwareness('wf-1', 'not-a-sendable-actor')).toBe(false)

    // Two reasons triggered, one of them twice: one warning per reason.
    expect(reportError).toHaveBeenCalledTimes(2)
    const reasons = vi
      .mocked(reportError)
      .mock.calls.map(([, options]) => options.tags?.reason)
    expect(reasons).toEqual(['workflow_id', 'actor'])
    expect(vi.mocked(reportError).mock.calls[0][1]).toMatchObject({
      errorType: 'agent_crdt_invalid_outgoing_frame',
      level: 'warning'
    })
    expect(transport.sent).toHaveLength(0)
  })
})
