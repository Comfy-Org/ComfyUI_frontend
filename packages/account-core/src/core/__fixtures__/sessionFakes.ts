import { vi } from 'vitest'

import { createTestIdentity } from '../../testing.js'
import type {
  AccountIdentity,
  AccountUser,
  CredentialStorage,
  SessionClientOptions
} from '../session.js'
import { createSessionClient } from '../session.js'

export const EXCHANGE_URL = 'https://cloud.test/api/auth/token'
export const NINETY_MINUTES_MS = 90 * 60 * 1000

export function memoryStorage(): CredentialStorage & {
  raw: () => string | null
} {
  let value: string | null = null
  return {
    read: () => value,
    write: (next) => {
      value = next
    },
    clear: () => {
      value = null
    },
    raw: () => value
  }
}

export function makeClient(
  overrides: Partial<SessionClientOptions> = {},
  identity?: AccountIdentity
) {
  const storage = memoryStorage()
  const client = createSessionClient(
    { exchangeUrl: EXCHANGE_URL, storage, ...overrides },
    identity
  )
  return { client, storage }
}

export function testUser(uid = 'uid-1', idToken = 'id-token-1'): AccountUser {
  return { uid, getIdToken: vi.fn(async () => idToken) }
}

export function mintResponse(token: string) {
  return new Response(
    JSON.stringify({
      token,
      permissions: ['workspace:read'],
      expires_at: new Date(Date.now() + NINETY_MINUTES_MS).toISOString(),
      workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
      role: 'owner'
    }),
    { status: 200 }
  )
}

export function okFetch(token = 'workspace-jwt') {
  return vi.fn<typeof fetch>(async () => mintResponse(token))
}

export function manualIdentity() {
  let deliver: ((user: AccountUser | null) => void) | undefined
  const unsubscribe = vi.fn()
  const port = createTestIdentity<AccountUser>({
    onUserChanged: (callback) => {
      deliver = callback
      return unsubscribe
    }
  })
  return {
    port,
    fire: (user: AccountUser | null) => deliver?.(user),
    unsubscribe
  }
}

export function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}
