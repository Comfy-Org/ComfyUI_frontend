import { describe, expect, it, vi } from 'vitest'

import {
  AGENT_IDENTITY_RETRY_BASE_MS,
  AGENT_IDENTITY_RETRY_MAX_MS,
  resolveAgentIdentity
} from './agentIdentity'

function harness(getIdentity: () => Promise<{ userId: string }>): ReturnType<
  typeof resolveAgentIdentity
> & {
  connect: () => void
  onFailure: ReturnType<typeof vi.fn>
  unsubscribe: ReturnType<typeof vi.fn>
} {
  const connected = new Set<() => void>()
  const unsubscribe = vi.fn()
  const onFailure = vi.fn()
  const identity = resolveAgentIdentity({
    getIdentity,
    onConnected(listener) {
      connected.add(listener)
      return unsubscribe
    },
    onFailure
  })
  return {
    ...identity,
    connect: () => connected.forEach((listener) => listener()),
    onFailure,
    unsubscribe
  }
}

/** Every listener/promise settled that the fake clock does not drive. */
async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0)
}

describe('resolveAgentIdentity (#17469)', () => {
  it('takes the identity from the first successful lookup', async () => {
    vi.useFakeTimers()
    const getIdentity = vi.fn(async () => ({ userId: 'local-user' }))

    const identity = harness(getIdentity)
    await flush()

    expect(identity.userId.value).toBe('local-user')
    expect(identity.onFailure).not.toHaveBeenCalled()
  })

  it('reports a failed lookup and retries it on the next connected edge once the backoff has passed', async () => {
    vi.useFakeTimers()
    const failure = new Error('identity route down')
    const getIdentity = vi
      .fn<() => Promise<{ userId: string }>>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValue({ userId: 'local-user' })

    const identity = harness(getIdentity)
    await flush()
    expect(identity.onFailure).toHaveBeenCalledWith(failure)
    expect(identity.userId.value).toBeNull()

    await vi.advanceTimersByTimeAsync(AGENT_IDENTITY_RETRY_BASE_MS)
    // Nothing retries on its own: the edge is the trigger.
    expect(getIdentity).toHaveBeenCalledTimes(1)

    identity.connect()
    await flush()

    expect(getIdentity).toHaveBeenCalledTimes(2)
    expect(identity.userId.value).toBe('local-user')
  })

  it('defers an edge inside the backoff window to the end of the window instead of dropping it', async () => {
    vi.useFakeTimers()
    const getIdentity = vi
      .fn<() => Promise<{ userId: string }>>()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValue({ userId: 'local-user' })

    const identity = harness(getIdentity)
    await flush()

    identity.connect()
    identity.connect()
    await vi.advanceTimersByTimeAsync(AGENT_IDENTITY_RETRY_BASE_MS - 1)
    expect(getIdentity).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)

    expect(getIdentity).toHaveBeenCalledTimes(2)
    expect(identity.userId.value).toBe('local-user')
  })

  it('doubles the backoff per failure up to the cap, so a hard failure cannot spin', async () => {
    vi.useFakeTimers()
    const getIdentity = vi.fn(async () => {
      throw new Error('down')
    })
    const identity = harness(getIdentity)
    await flush()

    const waits = [1, 2, 4, 8, 16, 32, 64].map((factor) =>
      Math.min(
        AGENT_IDENTITY_RETRY_BASE_MS * factor,
        AGENT_IDENTITY_RETRY_MAX_MS
      )
    )
    expect(waits.at(-1)).toBe(AGENT_IDENTITY_RETRY_MAX_MS)
    for (const [index, wait] of waits.entries()) {
      identity.connect()
      await vi.advanceTimersByTimeAsync(wait - 1)
      expect(getIdentity).toHaveBeenCalledTimes(index + 1)
      await vi.advanceTimersByTimeAsync(1)
      expect(getIdentity).toHaveBeenCalledTimes(index + 2)
    }
    expect(identity.onFailure).toHaveBeenCalledTimes(waits.length + 1)
  })

  it('ignores edges once resolved, and stop() unsubscribes and cancels a deferred retry', async () => {
    vi.useFakeTimers()
    const resolved = harness(vi.fn(async () => ({ userId: 'local-user' })))
    await flush()
    resolved.connect()
    await flush()
    expect(resolved.userId.value).toBe('local-user')

    const getIdentity = vi.fn(async () => {
      throw new Error('down')
    })
    const failing = harness(getIdentity)
    await flush()
    failing.connect()
    failing.stop()
    await vi.advanceTimersByTimeAsync(AGENT_IDENTITY_RETRY_MAX_MS)

    expect(failing.unsubscribe).toHaveBeenCalledTimes(1)
    expect(getIdentity).toHaveBeenCalledTimes(1)
  })
})
