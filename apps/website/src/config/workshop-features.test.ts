import type { SessionClient } from '@comfyorg/account-core/session'
import { describe, expect, it, vi } from 'vitest'

import { createBillingSdkTopupReader } from './workshop-features'

const FEATURES_URL = 'https://cloud.test/api/features'

type Snapshot = ReturnType<SessionClient['getSnapshot']>

function signedIn(uid: string): Snapshot {
  return {
    phase: 'authenticated',
    user: { uid, getIdToken: () => Promise.resolve(`${uid}-id-token`) },
    session: {
      token: `${uid}-jwt`,
      expiresAt: Number.MAX_SAFE_INTEGER,
      uid,
      workspace: { id: 'workspace-1', name: 'Personal', type: 'personal' },
      role: 'owner',
      permissions: []
    }
  }
}

const SIGNED_OUT: Snapshot = {
  phase: 'signed-out',
  user: null,
  session: undefined
}

function respondWith(body: unknown, status = 200) {
  return vi
    .fn<typeof fetch>()
    .mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(body), { status }))
    )
}

function readerOver(
  snapshot: () => Snapshot,
  fetchImpl: typeof fetch
): () => Promise<boolean> {
  return createBillingSdkTopupReader(
    { getSnapshot: snapshot },
    FEATURES_URL,
    fetchImpl
  )
}

describe('createBillingSdkTopupReader', () => {
  it.for([
    { body: { billing_sdk_topup_enabled: true }, expected: true },
    { body: { billing_sdk_topup_enabled: false }, expected: false },
    { body: { other_flag: true }, expected: false },
    { body: { billing_sdk_topup_enabled: 'true' }, expected: false },
    { body: { billing_sdk_topup_enabled: 1 }, expected: false },
    { body: { billing_sdk_topup_enabled: null }, expected: false },
    { body: 'enabled', expected: false }
  ])('resolves $expected for $body', async ({ body, expected }) => {
    const read = readerOver(() => signedIn('user-1'), respondWith(body))

    await expect(read()).resolves.toBe(expected)
  })

  it.for([401, 403, 404, 500])('is false on a %i response', async (status) => {
    const read = readerOver(
      () => signedIn('user-1'),
      respondWith({ billing_sdk_topup_enabled: true }, status)
    )

    await expect(read()).resolves.toBe(false)
  })

  it('is false when the request fails', async () => {
    const read = readerOver(
      () => signedIn('user-1'),
      vi.fn<typeof fetch>().mockRejectedValue(new Error('offline'))
    )

    await expect(read()).resolves.toBe(false)
  })

  it('is false without reading anything while signed out', async () => {
    const fetchFeatures = respondWith({ billing_sdk_topup_enabled: true })
    const read = readerOver(() => SIGNED_OUT, fetchFeatures)

    await expect(read()).resolves.toBe(false)
    expect(fetchFeatures).not.toHaveBeenCalled()
  })

  it('sends one authorized read per uid and re-reads for the next one', async () => {
    let snapshot = signedIn('user-1')
    const fetchFeatures = respondWith({ billing_sdk_topup_enabled: true })
    const read = readerOver(() => snapshot, fetchFeatures)

    await expect(Promise.all([read(), read()])).resolves.toEqual([true, true])
    await expect(read()).resolves.toBe(true)
    expect(fetchFeatures).toHaveBeenCalledOnce()
    expect(fetchFeatures).toHaveBeenCalledWith(
      FEATURES_URL,
      expect.objectContaining({
        headers: { Authorization: 'Bearer user-1-jwt' },
        cache: 'no-store'
      })
    )

    snapshot = signedIn('user-2')
    await expect(read()).resolves.toBe(true)
    expect(fetchFeatures).toHaveBeenCalledTimes(2)
    expect(fetchFeatures.mock.calls[1]?.[1]).toMatchObject({
      headers: { Authorization: 'Bearer user-2-jwt' }
    })
  })
})
