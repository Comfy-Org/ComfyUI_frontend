vi.mock(import('firebase/auth'))
vi.mock(import('@/services/dialogService'))
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useDialogService } from '@/services/dialogService'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'

import { ensureComfyCredential, withComfyCredential } from './comfyCredential'

function signIn({
  idToken,
  apiKey
}: {
  idToken?: string
  apiKey?: string
}): void {
  vi.mocked(useAuthStore().getIdToken).mockResolvedValue(idToken)
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
