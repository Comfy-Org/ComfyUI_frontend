import { fromPartial } from '@total-typescript/shoehorn'
import type { FirebaseApp } from 'firebase/app'
import { getApps, initializeApp } from 'firebase/app'
import type { Auth } from 'firebase/auth'
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  initializeAuth
} from 'firebase/auth'
import { describe, expect, it, vi } from 'vitest'

import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'

vi.mock(import('firebase/app'), { spy: true })
vi.mock(import('firebase/auth'))

const RUNTIME_CONFIG = {
  apiKey: 'runtime-key',
  authDomain: 'runtime.firebaseapp.com',
  projectId: 'runtime',
  storageBucket: 'runtime.appspot.com',
  messagingSenderId: '999',
  appId: '999'
}

describe('firebaseIdentity', () => {
  it('initializes the default app from the remote config present at first use, not at import, with local persistence and the popup resolver', async () => {
    vi.mocked(getApps).mockReturnValue([])
    vi.mocked(initializeApp).mockReturnValue(
      fromPartial<FirebaseApp>({ name: '[DEFAULT]' })
    )
    vi.mocked(initializeAuth).mockReturnValue(
      fromPartial<Auth>({ currentUser: null })
    )
    const { firebaseIdentity } = await import('./firebaseIdentity')
    remoteConfig.value = {
      ...remoteConfig.value,
      firebase_config: RUNTIME_CONFIG
    }

    firebaseIdentity.currentUser()

    expect(initializeApp).toHaveBeenCalledWith(RUNTIME_CONFIG, '[DEFAULT]')
    expect(initializeAuth).toHaveBeenCalledWith(
      { name: '[DEFAULT]' },
      {
        persistence: browserLocalPersistence,
        popupRedirectResolver: browserPopupRedirectResolver
      }
    )
  })
})
