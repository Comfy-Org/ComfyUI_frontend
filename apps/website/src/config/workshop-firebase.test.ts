import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  isWorkshopProvisioningError,
  provisionCustomer,
  signInWorkshopWithGoogle
} from './workshop-firebase'

const identity = vi.hoisted(() => ({
  signInWithGoogle: vi.fn(),
  signInWithGitHub: vi.fn(),
  signOut: vi.fn(),
  onUserChanged: vi.fn()
}))

vi.mock('@comfyorg/account/firebase', () => ({
  createFirebaseIdentity: () => identity
}))

describe('provisionCustomer', () => {
  const user = { getIdToken: async () => 'jwt' }

  it('sends the workshop signup source with the bearer token', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 201 }))

    await provisionCustomer(user, fetchImpl)

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
        provisionCustomer(user, fetchImpl),
        'the backend answers 200 for an existing customer; a 409 is a real conflict'
      ).rejects.toThrow(String(status))
    }
  )

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

describe('social sign-in provisioning boundary', () => {
  const user = { uid: 'u1', email: 'a@b.co', getIdToken: async () => 'jwt' }

  beforeEach(() => {
    identity.signInWithGoogle.mockReset()
  })

  it('rethrows a popup failure untouched, so the caller sees the Firebase code', async () => {
    const popupFailure = { code: 'auth/popup-closed-by-user', message: 'x' }
    identity.signInWithGoogle.mockRejectedValue(popupFailure)

    await expect(signInWorkshopWithGoogle()).rejects.toBe(popupFailure)
  })

  it('wraps a provisioning failure with the signed-in user and the original cause', async () => {
    identity.signInWithGoogle.mockResolvedValue({ user })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 500 }))
    )

    const failure = await signInWorkshopWithGoogle().catch((error) => error)

    expect(
      isWorkshopProvisioningError(failure),
      'the popup succeeded, so the page must keep the identity and say setup did not finish'
    ).toBe(true)
    expect(failure.user).toBe(user)
    expect(failure.cause).toBeInstanceOf(Error)
    expect(String(failure.cause)).toContain('500')
  })
})
