import { vi } from 'vitest'

import { createTestIdentity } from '../../testing.js'
import type { AccountUser, CredentialStorage } from '../session.js'

export const EXCHANGE_URL = 'https://cloud.test/api/auth/token'
export const NINETY_MINUTES_MS = 90 * 60 * 1000

export function testUser(uid = 'uid-1', idToken = 'id-token-1'): AccountUser {
  return { uid, getIdToken: vi.fn(async () => idToken) }
}

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

export function mintBody(overrides: Record<string, unknown> = {}) {
  return {
    token: 'workspace-jwt',
    permissions: ['workspace:read'],
    expires_at: new Date(Date.now() + NINETY_MINUTES_MS).toISOString(),
    workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
    role: 'owner',
    ...overrides
  }
}

export function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

export function mintResponse(token: string) {
  return jsonResponse(200, mintBody({ token }))
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
    fire: (user: AccountUser | null) => {
      if (!deliver)
        throw new Error('fire() before a client subscribed the port')
      deliver(user)
    },
    unsubscribe
  }
}
