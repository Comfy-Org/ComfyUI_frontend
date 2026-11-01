import { describe, expect, it, vi } from 'vitest'

import { timedSignal } from './requestTimeout'

describe('timedSignal', () => {
  it('forwards caller cancellation without a timeout', () => {
    const caller = new AbortController()
    const reason = new DOMException('Stopped', 'AbortError')
    const { signal } = timedSignal(caller.signal, undefined)

    caller.abort(reason)

    expect(signal?.reason).toBe(reason)
  })

  it('aborts when the timeout passes', () => {
    const { signal } = timedSignal(undefined, 100)

    vi.advanceTimersByTime(99)
    expect(signal?.aborted).toBe(false)
    vi.advanceTimersByTime(1)

    expect(signal?.aborted).toBe(true)
  })

  it('forwards the caller abort and its reason', () => {
    const caller = new AbortController()
    const reason = new DOMException('Stopped', 'AbortError')
    const { signal, release } = timedSignal(caller.signal, 1000)

    caller.abort(reason)

    expect(signal?.reason).toBe(reason)
    release()
  })

  it('starts aborted when the caller signal already is', () => {
    const caller = new AbortController()
    const reason = new DOMException('Stopped', 'AbortError')
    caller.abort(reason)

    const { signal, release } = timedSignal(caller.signal, 1000)

    expect(signal?.reason).toBe(reason)
    release()
  })

  it('stops the timer and detaches from the caller on release', () => {
    const caller = new AbortController()
    const { signal, release } = timedSignal(caller.signal, 100)

    release()
    vi.advanceTimersByTime(100)
    caller.abort()

    expect(signal?.aborted).toBe(false)
  })
})
