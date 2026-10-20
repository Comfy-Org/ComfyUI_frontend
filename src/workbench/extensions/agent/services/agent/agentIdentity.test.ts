import { beforeEach, describe, expect, it, vi } from 'vitest'

import { isRetryableRequestFailure } from '@/workbench/extensions/agent/composables/agent/useAgentSession'
import { resolveAgentIdentity } from './agentIdentity'
import { AgentApiError } from './agentRestClient'

function harness(
  getIdentity: () => Promise<{ userId: string }>,
  isRetryable: (error: unknown) => boolean = () => true
) {
  const connected = new Set<() => void>()
  const onFailure = vi.fn()
  const identity = resolveAgentIdentity({
    getIdentity,
    onSocketOpen(listener) {
      connected.add(listener)
      return () => connected.delete(listener)
    },
    isRetryable,
    onFailure
  })
  return {
    ...identity,
    connect: () => connected.forEach((listener) => listener()),
    onFailure
  }
}

async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0)
}

function failing(): () => Promise<{ userId: string }> {
  return vi.fn(async () => {
    throw new Error('down')
  })
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
})

describe('resolveAgentIdentity', () => {
  it('forgets the identity on reset and looks it up again', async () => {
    const getIdentity = vi
      .fn<() => Promise<{ userId: string }>>()
      .mockResolvedValueOnce({ userId: 'account-a' })
      .mockResolvedValueOnce({ userId: 'account-b' })
    const identity = harness(getIdentity)
    await flush()
    expect(identity.state.value).toEqual({
      status: 'resolved',
      userId: 'account-a'
    })

    identity.reset()
    expect(identity.state.value).toEqual({ status: 'pending' })
    await flush()

    expect(identity.state.value).toEqual({
      status: 'resolved',
      userId: 'account-b'
    })
  })

  it('discards a lookup that was still in flight for the previous account', async () => {
    let finishStale!: (value: { userId: string }) => void
    const getIdentity = vi
      .fn<() => Promise<{ userId: string }>>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishStale = resolve
          })
      )
      .mockResolvedValueOnce({ userId: 'account-b' })
    const identity = harness(getIdentity)

    identity.reset()
    await flush()
    finishStale({ userId: 'account-a' })
    await flush()

    expect(identity.state.value).toEqual({
      status: 'resolved',
      userId: 'account-b'
    })
  })

  it('reports a failed lookup and retries it on its own while the socket stays open', async () => {
    const failure = new Error('identity route down')
    const getIdentity = vi
      .fn<() => Promise<{ userId: string }>>()
      .mockRejectedValueOnce(failure)
      .mockRejectedValueOnce(failure)
      .mockResolvedValue({ userId: 'local-user' })

    const identity = harness(getIdentity)
    await flush()
    expect(identity.onFailure).toHaveBeenCalledWith(failure)
    expect(identity.state.value).toEqual({ status: 'pending' })

    await vi.advanceTimersByTimeAsync(1_000 + 2_000)

    expect(getIdentity).toHaveBeenCalledTimes(3)
    expect(identity.state.value).toEqual({
      status: 'resolved',
      userId: 'local-user'
    })
  })

  it('retries at once when the socket connects again after a failure', async () => {
    const getIdentity = vi
      .fn<() => Promise<{ userId: string }>>()
      .mockRejectedValueOnce(new Error('agent still starting'))
      .mockResolvedValue({ userId: 'local-user' })

    const identity = harness(getIdentity)
    await flush()
    identity.connect()
    await flush()

    expect(getIdentity).toHaveBeenCalledTimes(2)
    expect(identity.state.value).toEqual({
      status: 'resolved',
      userId: 'local-user'
    })
  })

  it('doubles the retry delay per failure up to the cap, so a hard failure cannot spin', async () => {
    const getIdentity = failing()
    const identity = harness(getIdentity)
    await flush()

    const waits = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000]
    for (const [index, wait] of waits.entries()) {
      await vi.advanceTimersByTimeAsync(wait - 1)
      expect(getIdentity).toHaveBeenCalledTimes(index + 1)
      await vi.advanceTimersByTimeAsync(1)
      expect(getIdentity).toHaveBeenCalledTimes(index + 2)
    }
    expect(identity.state.value).toEqual({ status: 'rejected' })
  })

  it('looks the identity up once and ignores later connected edges', async () => {
    const getIdentity = vi.fn(async () => ({ userId: 'local-user' }))
    const identity = harness(getIdentity)
    await flush()

    identity.connect()
    await flush()

    expect(getIdentity).toHaveBeenCalledOnce()
    expect(identity.state.value).toEqual({
      status: 'resolved',
      userId: 'local-user'
    })
  })

  it('restarts the backoff on reset', async () => {
    const getIdentity = failing()
    const identity = harness(getIdentity)
    await vi.advanceTimersByTimeAsync(1_000 + 2_000)
    expect(getIdentity).toHaveBeenCalledTimes(3)

    identity.reset()
    await flush()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(getIdentity).toHaveBeenCalledTimes(5)
  })

  it('does not retry a failure that is not retryable', async () => {
    const getIdentity = failing()
    harness(getIdentity, () => false)

    await vi.advanceTimersByTimeAsync(30_000)

    expect(getIdentity).toHaveBeenCalledOnce()
  })

  it('settles a failure that is not retryable as rejected until reset', async () => {
    const getIdentity = vi
      .fn<() => Promise<{ userId: string }>>()
      .mockRejectedValueOnce(new Error('unauthorized'))
      .mockResolvedValue({ userId: 'account-b' })
    const identity = harness(getIdentity, () => false)
    await flush()
    expect(identity.state.value).toEqual({ status: 'rejected' })

    identity.reset()
    expect(identity.state.value).toEqual({ status: 'pending' })
    await flush()

    expect(identity.state.value).toEqual({
      status: 'resolved',
      userId: 'account-b'
    })
  })

  it('reports nothing for a lookup that fails after stop()', async () => {
    let failLookup!: (error: Error) => void
    const identity = harness(
      () =>
        new Promise((_, reject) => {
          failLookup = reject
        })
    )

    identity.stop()
    failLookup(new Error('down'))
    await flush()

    expect(identity.onFailure).not.toHaveBeenCalled()
  })

  it('starts no lookup after stop()', async () => {
    const getIdentity = failing()
    const identity = harness(getIdentity)
    await flush()

    identity.stop()
    identity.connect()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(getIdentity).toHaveBeenCalledOnce()
  })
  it('settles as rejected when the identity route does not exist', async () => {
    const getIdentity = vi.fn(async (): Promise<{ userId: string }> => {
      throw new AgentApiError('not found', 404, null)
    })
    const identity = harness(getIdentity, (error) =>
      isRetryableRequestFailure(error, false)
    )
    await flush()

    expect(identity.state.value).toEqual({ status: 'rejected' })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(getIdentity).toHaveBeenCalledOnce()
  })

  it('settles as rejected once a transient failure outlasts the retry budget', async () => {
    const getIdentity = failing()
    const identity = harness(getIdentity)

    await vi.advanceTimersByTimeAsync(10 * 60_000)

    expect(identity.state.value).toEqual({ status: 'rejected' })
    expect(getIdentity).toHaveBeenCalledTimes(8)
    expect(identity.onFailure).toHaveBeenCalledTimes(8)
  })

  it('looks the identity up again when the socket reopens after the budget ran out', async () => {
    const getIdentity = vi
      .fn<() => Promise<{ userId: string }>>()
      .mockRejectedValue(new Error('agent still starting'))
    const identity = harness(getIdentity)
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(identity.state.value).toEqual({ status: 'rejected' })

    getIdentity.mockResolvedValue({ userId: 'local-user' })
    identity.connect()
    await flush()

    expect(identity.state.value).toEqual({
      status: 'resolved',
      userId: 'local-user'
    })
  })
})
