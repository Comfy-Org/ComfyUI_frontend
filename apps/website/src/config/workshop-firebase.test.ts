import type { UserCredential } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  isWorkshopProvisioningError,
  provisionCustomer,
  provisionWorkshopCustomer,
  signInWorkshopWithEmail,
  signInWorkshopWithGoogle,
  signUpWorkshopWithEmail
} from './workshop-firebase'

const h = vi.hoisted(() => ({
  captureRollback: vi.fn(),
  createUserWithEmail: vi.fn(),
  signInWithEmail: vi.fn(),
  signInWithGoogle: vi.fn(),
  // Captured at module load; a plain field survives the suite's mockReset.
  identityConfig: undefined as { actionTimeoutMs?: number } | undefined
}))

vi.mock<unknown>(import('../scripts/posthog'), () => ({
  captureSignupRollbackFailure: h.captureRollback
}))

vi.mock<unknown>(import('@comfyorg/account/firebase'), () => ({
  createFirebaseIdentity: (config: { actionTimeoutMs?: number }) => {
    h.identityConfig = config
    return {
      onUserChanged: vi.fn(() => () => undefined),
      signInWithGoogle: h.signInWithGoogle,
      signInWithGitHub: vi.fn(),
      signInWithEmail: h.signInWithEmail,
      createUserWithEmail: h.createUserWithEmail,
      sendPasswordReset: vi.fn(),
      signOut: vi.fn()
    }
  }
}))

describe('provisionCustomer', () => {
  const user = { getIdToken: async () => 'jwt' }

  it('sends the workshop signup source with the bearer token', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 201 }))

    await provisionCustomer(user, { fetchImpl })

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit
    ]
    expect(url).toMatch(/\/customers$/)
    expect(init.headers).toMatchObject({ Authorization: 'Bearer jwt' })
    expect(JSON.parse(String(init.body))).toEqual({
      signup_source: 'comfy-workshop'
    })
  })

  it.for([400, 401, 409, 500])(
    'fails on a %s answer instead of treating it as an existing customer',
    async (status) => {
      const fetchImpl = vi.fn(async () => new Response(null, { status }))

      await expect(
        provisionCustomer(user, { fetchImpl }),
        'the backend answers 200 for an existing customer; a 409 is a real conflict'
      ).rejects.toThrow(String(status))
    }
  )

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

describe('social sign-in provisioning boundary', () => {
  const user = { uid: 'u1', email: 'a@b.co', getIdToken: async () => 'jwt' }

  beforeEach(() => {
    h.signInWithGoogle.mockReset()
  })

  it('rethrows a popup failure untouched, so the caller sees the Firebase code', async () => {
    const popupFailure = { code: 'auth/popup-closed-by-user', message: 'x' }
    h.signInWithGoogle.mockRejectedValue(popupFailure)

    await expect(signInWorkshopWithGoogle()).rejects.toBe(popupFailure)
  })

  it('wraps a provisioning failure with the signed-in user and the original cause', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 500 }))
    )

    const failure = await provisionWorkshopCustomer({
      user
    } as unknown as UserCredential).catch((error) => error)

    expect(
      isWorkshopProvisioningError(failure),
      'the sign-in succeeded, so the page keeps the identity and says setup did not finish'
    ).toBe(true)
    expect(failure.user).toBe(user)
    expect(String(failure.cause)).toContain('500')
  })
})

describe('email sign-in boundary', () => {
  it('rethrows a credential failure untouched', async () => {
    const wrong = { code: 'auth/wrong-password', message: 'x' }
    h.signInWithEmail.mockRejectedValue(wrong)

    await expect(signInWorkshopWithEmail('a@b.co', 'nope')).rejects.toBe(wrong)
  })
})

describe('bounded action ceiling', () => {
  it('hands the package a finite ceiling so a stalled email sign-in or reset cannot pin the form', () => {
    expect(
      Number.isFinite(h.identityConfig?.actionTimeoutMs),
      'without a finite actionTimeoutMs the package leaves email sign-in and reset unbounded'
    ).toBe(true)
  })
})
