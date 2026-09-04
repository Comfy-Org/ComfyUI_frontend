import { describe, expect, it } from 'vitest'

import { isCustomerProvisioned } from './workshop-firebase'

describe('isCustomerProvisioned', () => {
  it('accepts a successful create', () => {
    expect(isCustomerProvisioned(201, true)).toBe(true)
  })

  it('treats a 409 conflict as already-provisioned success', () => {
    expect(
      isCustomerProvisioned(409, false),
      'a repeat social sign-in must not fail on an existing customer'
    ).toBe(true)
  })

  it.for([400, 401, 403, 500, 503])('rejects a %s response', (status) => {
    expect(isCustomerProvisioned(status, false)).toBe(false)
  })
})
