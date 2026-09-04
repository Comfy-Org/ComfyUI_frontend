import { describe, expect, it } from 'vitest'

import { isCustomerProvisioned } from './workshop-firebase'

// The Firebase-effect exports (sign-in, sign-out, the auth-state listener)
// dynamically import firebase/auth, which vi.mock cannot intercept in this
// workspace, so the module is excluded from coverage and exercised through
// its consumers (which mock this module). Only the pure decision helper is
// unit-tested here.
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
