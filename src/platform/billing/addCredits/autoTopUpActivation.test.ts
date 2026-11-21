import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { HostedTopupCheckout } from '@comfyorg/ingest-types'

import { readAutoTopUpActivation } from './autoTopUpActivation'

const ACCEPTED = {
  threshold_credits: 1000,
  target_credits: 11_550,
  monthly_budget_cents: 2000,
  monthly_budget_is_default: false
}

function checkout(
  fields: Partial<HostedTopupCheckout> = {}
): HostedTopupCheckout {
  return {
    session_id: 'cs_1',
    amount_cents: 5000,
    payment_amount_cents: 5000,
    state: 'fulfilled',
    auto_top_up: ACCEPTED,
    ...fields
  }
}

async function readServed(...served: HostedTopupCheckout[]) {
  const read = vi.fn<() => Promise<HostedTopupCheckout>>()
  for (const next of served) read.mockResolvedValueOnce(next)
  const outcome = readAutoTopUpActivation(read, new AbortController().signal)
  await vi.runAllTimersAsync()
  return { outcome: await outcome }
}

describe('readAutoTopUpActivation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('reports on with the accepted settings the server echoed', async () => {
    const { outcome } = await readServed(
      checkout({ auto_top_up_activation: 'on' })
    )

    expect(outcome).toEqual({
      status: 'on',
      settings: {
        threshold_credits: 1000,
        target_credits: 11_550,
        monthly_budget_cents: 2000
      }
    })
  })

  it('reads a stored default ceiling as no owner limit', async () => {
    const { outcome } = await readServed(
      checkout({
        auto_top_up_activation: 'on',
        auto_top_up: { ...ACCEPTED, monthly_budget_is_default: true }
      })
    )

    expect(outcome).toMatchObject({
      status: 'on',
      settings: { monthly_budget_cents: null }
    })
  })

  it('reports failed when the server could not turn it on', async () => {
    const { outcome } = await readServed(
      checkout({
        auto_top_up_activation: 'failed',
        auto_top_up_activation_reason: 'activation_error'
      })
    )

    expect(outcome).toEqual({ status: 'failed' })
  })

  it.for([
    {
      name: 'not_attempted',
      served: { auto_top_up_activation: 'not_attempted' }
    },
    {
      name: 'on without accepted settings',
      served: { auto_top_up_activation: 'on', auto_top_up: undefined }
    }
  ] as const)('reports no outcome for $name', async ({ served }) => {
    const { outcome } = await readServed(checkout(served))

    expect(outcome).toBeUndefined()
  })

  it('keeps reading while pending and through a failed read', async () => {
    const read = vi
      .fn<() => Promise<HostedTopupCheckout>>()
      .mockResolvedValueOnce(checkout({ auto_top_up_activation: 'pending' }))
      .mockRejectedValueOnce(new Error('503'))
      .mockResolvedValueOnce(checkout({ auto_top_up_activation: 'on' }))
    const outcome = readAutoTopUpActivation(read, new AbortController().signal)
    await vi.runAllTimersAsync()

    expect(await outcome).toMatchObject({ status: 'on' })
    expect(read).toHaveBeenCalledTimes(3)
  })

  it('gives up with no outcome while activation stays pending', async () => {
    const read = vi
      .fn<() => Promise<HostedTopupCheckout>>()
      .mockResolvedValue(checkout({ auto_top_up_activation: 'pending' }))
    const outcome = readAutoTopUpActivation(read, new AbortController().signal)
    await vi.runAllTimersAsync()

    expect(await outcome).toBeUndefined()
  })

  it('stops reading once the dialog lets go', async () => {
    const scope = new AbortController()
    const read = vi
      .fn<() => Promise<HostedTopupCheckout>>()
      .mockResolvedValue(checkout({ auto_top_up_activation: 'pending' }))
    const outcome = readAutoTopUpActivation(read, scope.signal)
    const settled = outcome.catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(0)
    scope.abort()
    await vi.runAllTimersAsync()

    expect(await settled).toBeInstanceOf(Error)
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('reads nothing once the dialog has already let go', async () => {
    const scope = new AbortController()
    scope.abort()
    const read = vi.fn<(signal: AbortSignal) => Promise<HostedTopupCheckout>>()

    await expect(readAutoTopUpActivation(read, scope.signal)).rejects.toThrow()
    expect(read).not.toHaveBeenCalled()
  })

  it('cancels the read in flight when the dialog lets go', async () => {
    const scope = new AbortController()
    const read = vi.fn(
      (signal: AbortSignal) =>
        new Promise<HostedTopupCheckout>((_, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason))
        })
    )
    const outcome = readAutoTopUpActivation(read, scope.signal)
    scope.abort()

    await expect(outcome).rejects.toThrow()
    expect(read).toHaveBeenCalledWith(scope.signal)
  })
})
