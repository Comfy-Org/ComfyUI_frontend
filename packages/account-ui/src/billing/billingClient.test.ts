import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NOW, createBillingHarness } from './__fixtures__/billingHarness'
import { disposeBillingClient } from './billingClient'

const SUPERSEDED = { status: 'error', code: 'SUPERSEDED' }

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

describe('disposeBillingClient', () => {
  it('stops the readers serving the scope they were built for', async () => {
    const { client } = createBillingHarness()
    await client.credits.read()
    await client.capabilities.read()
    await client.status.read()
    expect(client.credits.getSnapshot()).toBeDefined()
    expect(client.capabilities.getSnapshot()).toBeDefined()
    expect(client.status.getSnapshot()).toBeDefined()

    disposeBillingClient(client)

    expect(
      client.credits.getSnapshot(),
      'a retained balance belongs to the previous account'
    ).toBeUndefined()
    expect(client.capabilities.getSnapshot()).toBeUndefined()
    expect(client.status.getSnapshot()).toBeUndefined()
    await expect(client.credits.read()).resolves.toEqual(SUPERSEDED)
    await expect(client.capabilities.read()).resolves.toEqual(SUPERSEDED)
    await expect(client.status.read()).resolves.toEqual(SUPERSEDED)
  })

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
