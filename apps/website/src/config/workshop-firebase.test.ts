import { describe, expect, it, vi } from 'vitest'

import { isCustomerProvisioned, provisionCustomer } from './workshop-firebase'

describe('isCustomerProvisioned', () => {
  it('accepts ok and treats a 409 as already-provisioned', () => {
    expect(isCustomerProvisioned(201, true)).toBe(true)
    expect(
      isCustomerProvisioned(409, false),
      'a repeat social sign-in must not fail on an existing customer'
    ).toBe(true)
  })

  it.for([400, 401, 403, 500, 503])('rejects a %s response', (status) => {
    expect(isCustomerProvisioned(status, false)).toBe(false)
  })
})

describe('provisionCustomer', () => {
  const user = { getIdToken: async () => 'jwt' }

  it('bounds the POST with an abort signal so a hung request cannot strand sign-in', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 201 }))

    await provisionCustomer(user, fetchImpl)

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(
      init.signal,
      'a provisioning POST without an abort signal hangs sign-in forever'
    ).toBeInstanceOf(AbortSignal)
  })
})
