vi.mock(import('firebase/auth'))
vi.mock(import('@/services/dialogService'))
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useDialogService } from '@/services/dialogService'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'

import { ensureComfyCredential, withComfyCredential } from './comfyCredential'

function signIn({
  firebase = false,
  idToken,
  apiKey
}: {
  firebase?: boolean
  idToken?: string
  apiKey?: string
}): void {
  const authStore = useAuthStore()
  authStore.currentUser =
    firebase || idToken !== undefined ? ({ uid: 'user-1' } as User) : null
  vi.mocked(authStore.getIdToken).mockResolvedValue(idToken)
  vi.mocked(useApiKeyAuthStore().getApiKey).mockReturnValue(apiKey ?? null)
}

describe('withComfyCredential', () => {
  it.for([
    {
      account: 'a Firebase session',
      credential: { idToken: 'id-token', apiKey: 'comfyui-key' },
      header: 'id-token'
    },
    {
      account: 'an API-key session',
      credential: { apiKey: 'comfyui-key' },
      header: 'comfyui-key'
    },
    { account: 'a signed-out user', credential: {}, header: null }
  ])(
    'sends the credential of $account as X-Comfy-Token',
    async ({ credential, header }) => {
      signIn(credential)

      const init = await withComfyCredential({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const headers = new Headers(init.headers)
      expect(headers.get('X-Comfy-Token')).toBe(header)
      expect(headers.get('Content-Type')).toBe('application/json')
      expect(init.method).toBe('POST')
    }
  )

  it('sends no API key when the Firebase session fails to produce a token', async () => {
    signIn({ firebase: true, apiKey: 'comfyui-key' })

    const init = await withComfyCredential({ method: 'GET' })

    expect(new Headers(init.headers).has('X-Comfy-Token')).toBe(false)
    expect(useApiKeyAuthStore().getApiKey).not.toHaveBeenCalled()
  })

  it('refuses redirects on a request carrying the credential', async () => {
    signIn({ idToken: 'id-token' })

    const init = await withComfyCredential({ method: 'GET' })

    expect(init.redirect).toBe('error')
  })

  it('leaves the redirect policy alone when no credential is attached', async () => {
    signIn({})

    const init = await withComfyCredential({ method: 'GET' })

    expect(init.redirect).toBeUndefined()
  })
})

describe('ensureComfyCredential', () => {
  beforeEach(() => {
    vi.mocked(useDialogService().showSignInDialog).mockReset()
  })

  it('lets a signed-in user send without asking', async () => {
    signIn({ idToken: 'id-token' })

    await expect(ensureComfyCredential()).resolves.toBe(true)
    expect(useDialogService().showSignInDialog).not.toHaveBeenCalled()
  })

  it('asks a signed-out user to sign in and holds the turn if they decline', async () => {
    signIn({})
    vi.mocked(useDialogService().showSignInDialog).mockResolvedValue(false)

    await expect(ensureComfyCredential()).resolves.toBe(false)
    expect(useDialogService().showSignInDialog).toHaveBeenCalledOnce()
  })

  it('sends once the sign-in dialog produced a credential', async () => {
    signIn({})
    vi.mocked(useDialogService().showSignInDialog).mockImplementation(
      async () => {
        signIn({ idToken: 'fresh-token' })
        return true
      }
    )

    await expect(ensureComfyCredential()).resolves.toBe(true)
  })

  it('holds the turn when the sign-in dialog fails to open', async () => {
    signIn({})
    vi.mocked(useDialogService().showSignInDialog).mockRejectedValue(
      new Error('chunk failed')
    )

    await expect(ensureComfyCredential()).resolves.toBe(false)
  })

  it('sends without asking in development, where the dev proxy injects a token', async () => {
    vi.stubEnv('MODE', 'development')
    signIn({})

    await expect(ensureComfyCredential()).resolves.toBe(true)
    expect(useDialogService().showSignInDialog).not.toHaveBeenCalled()
  })
})
