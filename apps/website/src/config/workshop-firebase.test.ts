import { describe, expect, it, vi } from 'vitest'

import {
  isCustomerProvisioned,
  provisionCustomer,
  signUpWorkshopWithEmail
} from './workshop-firebase'

const h = vi.hoisted(() => ({
  captureRollback: vi.fn(),
  createUserWithEmail: vi.fn()
}))

vi.mock('../scripts/posthog', () => ({
  captureSignupRollbackFailure: h.captureRollback
}))

vi.mock('@comfyorg/account/firebase', () => ({
  createFirebaseIdentity: () => ({
    onUserChanged: vi.fn(() => () => undefined),
    signInWithGoogle: vi.fn(),
    signInWithGitHub: vi.fn(),
    signInWithEmail: vi.fn(),
    createUserWithEmail: h.createUserWithEmail,
    sendPasswordReset: vi.fn(),
    signOut: vi.fn()
  })
}))

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

    await provisionCustomer(user, { fetchImpl })

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(
      init.signal,
      'a provisioning POST without an abort signal hangs sign-in forever'
    ).toBeInstanceOf(AbortSignal)
  })

  it('sends the Turnstile token using the customer API wire name', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 201 }))

    await provisionCustomer(user, {
      turnstileToken: 'cf-token',
      fetchImpl
    })

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toEqual({
      signup_source: 'comfy-workshop',
      turnstile_token: 'cf-token'
    })
  })
})

describe('signUpWorkshopWithEmail rollback reporting', () => {
  function armSignUp(deleteFn: () => Promise<void>) {
    h.createUserWithEmail.mockResolvedValue({
      user: { delete: deleteFn, getIdToken: async () => 'jwt' }
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 500 }))
    )
  }

  it('reports a rollback that still failed after its retry', async () => {
    const deleteFn = vi.fn(async () => {
      throw new Error('delete down')
    })
    armSignUp(deleteFn)

    await expect(
      signUpWorkshopWithEmail('a@b.example', 'hunter22!', 'cf-token')
    ).rejects.toThrow('Customer provisioning failed')

    expect(deleteFn).toHaveBeenCalledTimes(2)
    expect(
      h.captureRollback,
      'a double delete failure orphans the account; without the event nobody ever learns'
    ).toHaveBeenCalledOnce()
  })

  it('stays silent when the rollback delete recovers', async () => {
    const deleteFn = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('blip'))
      .mockResolvedValueOnce(undefined)
    armSignUp(deleteFn)

    await expect(
      signUpWorkshopWithEmail('a@b.example', 'hunter22!', 'cf-token')
    ).rejects.toThrow('Customer provisioning failed')

    expect(h.captureRollback).not.toHaveBeenCalled()
  })
})
