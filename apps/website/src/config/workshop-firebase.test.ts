// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'

import * as firebaseAuth from 'firebase/auth'

import {
  isCustomerProvisioned,
  onWorkshopUserChanged,
  signInWorkshopWithGitHub,
  signInWorkshopWithGoogle,
  signOutWorkshop
} from './workshop-firebase'

vi.mock('firebase/app', () => ({
  getApps: vi.fn(() => []),
  initializeApp: vi.fn(() => ({ name: 'workshop' }))
}))

vi.mock('firebase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof firebaseAuth>()
  return {
    ...actual,
    getAuth: vi.fn(() => ({})),
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn(),
    GoogleAuthProvider: class {},
    GithubAuthProvider: class {}
  }
})

const mockedPopup = vi.mocked(firebaseAuth.signInWithPopup)
const mockedSignOut = vi.mocked(firebaseAuth.signOut)
const mockedOnAuthStateChanged = vi.mocked(firebaseAuth.onAuthStateChanged)

const credential = (overrides = {}) =>
  ({
    user: { getIdToken: vi.fn(async () => 'id-token'), ...overrides }
  }) as unknown as firebaseAuth.UserCredential

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

describe('social sign-in', () => {
  it('signs in with Google, then provisions the customer with the id token', async () => {
    mockedPopup.mockResolvedValue(credential())
    const fetchMock = vi.fn(async () => new Response(null, { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    await signInWorkshopWithGoogle()

    expect(mockedPopup).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit
    ]
    expect(url).toContain('/customers')
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer id-token'
    )
  })

  it('signs in with GitHub and provisions', async () => {
    mockedPopup.mockResolvedValue(credential())
    const fetchMock = vi.fn(async () => new Response(null, { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    await signInWorkshopWithGitHub()

    expect(mockedPopup).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('treats a 409 from provisioning as success (returning social user)', async () => {
    mockedPopup.mockResolvedValue(credential())
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 409 }))
    )

    await expect(signInWorkshopWithGoogle()).resolves.toBeDefined()
  })

  it('throws when provisioning fails with a non-ok, non-409 status', async () => {
    mockedPopup.mockResolvedValue(credential())
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 500 }))
    )

    await expect(signInWorkshopWithGoogle()).rejects.toThrow(/500/)
  })

  it('does not provision when the popup itself rejects', async () => {
    mockedPopup.mockRejectedValue(new Error('popup closed'))
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(signInWorkshopWithGoogle()).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('signOutWorkshop', () => {
  it('delegates to Firebase signOut', async () => {
    mockedSignOut.mockResolvedValue()
    await signOutWorkshop()
    expect(mockedSignOut).toHaveBeenCalledOnce()
  })
})

describe('onWorkshopUserChanged', () => {
  it('subscribes via onAuthStateChanged and returns its unsubscribe', () => {
    const unsub = vi.fn()
    mockedOnAuthStateChanged.mockReturnValue(unsub)
    const cb = vi.fn()

    const returned = onWorkshopUserChanged(cb)

    expect(mockedOnAuthStateChanged).toHaveBeenCalledOnce()
    expect(returned).toBe(unsub)
  })
})
