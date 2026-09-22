import type { BillingResult } from '@comfyorg/account-core/billing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NOW, createBillingHarness } from './__fixtures__/billingHarness'
import type { BillingClient } from './billingClient'
import { disposeBillingClient } from './billingClient'

const SUPERSEDED = { status: 'error', code: 'SUPERSEDED' }

interface ScopedReader {
  read: () => Promise<BillingResult<unknown>>
  getSnapshot: () => unknown
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

describe('disposeBillingClient', () => {
  it.for([
    { reader: 'credits', select: (client: BillingClient) => client.credits },
    {
      reader: 'capabilities',
      select: (client: BillingClient) => client.capabilities
    },
    { reader: 'status', select: (client: BillingClient) => client.status },
    { reader: 'plans', select: (client: BillingClient) => client.plans },
    {
      reader: 'paymentMethods',
      select: (client: BillingClient) => client.paymentMethods
    }
  ])(
    'stops the $reader reader serving the scope it was built for',
    async ({ select }) => {
      const { client } = createBillingHarness()
      const reader: ScopedReader = select(client)
      await expect(reader.read()).resolves.toMatchObject({ status: 'ok' })

      disposeBillingClient(client)

      expect(
        reader.getSnapshot(),
        'a retained read belongs to the previous account'
      ).toBeUndefined()
      await expect(reader.read()).resolves.toEqual(SUPERSEDED)
    }
  )

  it("stops subscribe reading the disposed scope's status", async () => {
    const { client, routes } = createBillingHarness()

    disposeBillingClient(client)

    await expect(
      client.commands.subscribe({
        plan_slug: 'pro-monthly',
        confirmation_token: 'ctoken_123'
      })
    ).resolves.toEqual(SUPERSEDED)
    expect(routes()).toEqual([])
  })

  it('supersedes the lifecycle so no further operation is issued on the old scope', async () => {
    const { client, routes } = createBillingHarness()

    disposeBillingClient(client)

    const issue = vi.fn(async () => ({
      status: 'ok' as const,
      value: { operationId: 'op-1' }
    }))
    await expect(client.lifecycle.begin('topup', issue)).resolves.toEqual(
      SUPERSEDED
    )
    expect(issue).not.toHaveBeenCalled()
    expect(routes().filter((route) => route.startsWith('POST'))).toEqual([])
  })
})
