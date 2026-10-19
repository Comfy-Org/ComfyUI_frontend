import { expect, it, vi } from 'vitest'

import type { WebSessionIdentityState } from '@comfyorg/account-core/webSessionIdentity'

import {
  bootWorkshopWebSession,
  useWorkshopSessionAccount
} from './workshop-web-session-identity'

const identity = vi.hoisted(() => {
  const listeners: ((state: WebSessionIdentityState) => void)[] = []
  return {
    listeners,
    double: {
      getState: () => ({ phase: 'idle' as const }),
      subscribe: vi.fn((listener: (state: WebSessionIdentityState) => void) => {
        listeners.push(listener)
        return () => {}
      }),
      boot: vi.fn(),
      signedIn: vi.fn(),
      signOut: vi.fn(),
      refresh: vi.fn(),
      getEpoch: () => 0,
      dispose: vi.fn()
    }
  }
})

vi.mock(import('@comfyorg/account-core/webSessionIdentity'), () => ({
  createWebSessionIdentity: () => identity.double
}))
vi.mock(import('./workshop-firebase'))

it('stops showing the account once the session signs out', () => {
  const decide = vi.fn()
  bootWorkshopWebSession(decide)
  const [publish] = identity.listeners

  publish({
    phase: 'signed_in',
    session: {
      user: { id: 'uid-1', email: 'a@b.c', emailVerified: true },
      csrfToken: 'csrf',
      expiresAt: Number.MAX_SAFE_INTEGER,
      absoluteExpiresAt: Number.MAX_SAFE_INTEGER
    }
  })
  expect(useWorkshopSessionAccount().value?.id).toBe('uid-1')

  publish({ phase: 'signed_out', outcome: 'revoked' })
  expect(useWorkshopSessionAccount().value).toBeUndefined()
  expect(decide).toHaveBeenLastCalledWith('firebase')
})
