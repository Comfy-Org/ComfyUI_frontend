import { getAuth, signInWithCredential, signOut } from 'firebase/auth'
import type { Auth, UserCredential } from 'firebase/auth'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { safeSessionStorage } from '@/base/storage/safeStorage'

import {
  beginProviderNavigation,
  exchangeProviderReturn,
  takeProviderReturn
} from './editorProviderNavigation'
import type { ProviderReturn } from './editorProviderNavigation'

vi.mock(import('firebase/auth'), { spy: true })
beforeEach(() => {
  vi.mocked(getAuth).mockReturnValue({} as Auth)
  vi.mocked(signOut).mockResolvedValue()
})
vi.mock(import('@/config/firebase'), () => ({
  getFirebaseConfig: () => ({ apiKey: 'fixture' })
}))

function callback(): ProviderReturn {
  return {
    attempt: {
      provider: 'google',
      sessionId: 'test-session',
      state: 'expected',
      at: Date.now(),
      destination: '/cloud/login'
    },
    requestUri:
      location.origin + '/oauth/editor-callback.html?code=result&state=expected'
  }
}

afterEach(() => {
  sessionStorage.clear()
})

describe('editor provider navigation', () => {
  it('keeps the user on the sign-in page when session storage cannot survive navigation', async () => {
    const persistent = vi
      .spyOn(safeSessionStorage, 'isPersistent', 'get')
      .mockReturnValueOnce(false)
    history.replaceState(null, '', '/cloud/login')
    try {
      await expect(
        beginProviderNavigation('google', () => true)
      ).resolves.toEqual(new Error('Browser session storage is unavailable.'))
      expect(fetch).not.toHaveBeenCalled()
      expect(location.pathname).toBe('/cloud/login')
    } finally {
      persistent.mockRestore()
    }
  })

  it('consumes the callback and attempt once in the initiating tab', () => {
    history.replaceState(null, '', '/cloud/login')
    const value = callback()
    sessionStorage.setItem(
      'Comfy.EditorProvider',
      JSON.stringify(value.attempt)
    )
    sessionStorage.setItem('Comfy.EditorProvider.callback', value.requestUri)
    expect(takeProviderReturn()).toEqual(value)
    expect(takeProviderReturn()).toBeUndefined()
    expect(sessionStorage.getItem('Comfy.EditorProvider')).toBeNull()
  })

  it.for([
    'state=changed&code=result',
    'state=expected&state=expected&code=result',
    'state=expected&error=access_denied',
    'state=expected&code=a&code=b'
  ])(
    'declines a cancelled or ambiguous callback before exchange (%s)',
    async (search) => {
      const send = vi.mocked(fetch)
      const value = callback()
      value.requestUri = value.requestUri.split('?')[0] + '?' + search
      await expect(
        exchangeProviderReturn(value, () => true)
      ).resolves.toBeInstanceOf(Error)
      expect(send).not.toHaveBeenCalled()
    }
  )

  it('discards the provider credential when the initiating page has gone away', async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        providerId: 'google.com',
        localId: 'u',
        oauthIdToken: 'id'
      })
    )
    await expect(
      exchangeProviderReturn(callback(), () => false)
    ).resolves.toBeInstanceOf(Error)
    expect(signInWithCredential).not.toHaveBeenCalled()
  })

  it('signs out when the SDK restored a different user', async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        providerId: 'google.com',
        localId: 'first',
        oauthIdToken: 'id'
      })
    )
    vi.mocked(signInWithCredential).mockResolvedValue({
      user: { uid: 'second' }
    } as UserCredential)
    await expect(
      exchangeProviderReturn(callback(), () => true)
    ).resolves.toBeInstanceOf(Error)
    expect(signOut).toHaveBeenCalledOnce()
  })

  it('rejects authorization destinations outside the requested provider', async () => {
    const url = new URL('https://unrelated.example/authorize')
    url.searchParams.set('state', 's')
    url.searchParams.set(
      'redirect_uri',
      location.origin + '/oauth/editor-callback.html'
    )
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        sessionId: 'session',
        authUri: url.href
      })
    )
    await expect(
      beginProviderNavigation('github', () => true)
    ).resolves.toBeInstanceOf(Error)
    expect(sessionStorage.getItem('Comfy.EditorProvider')).toBeNull()
  })
})
