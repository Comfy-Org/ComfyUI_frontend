/**
 * The user and token-exchange fakes the workshop session suites share. A
 * suite keeps the transitions it drives; only the exchange contract lives here.
 */
import { vi } from 'vitest'

import type { User, UserCredential } from 'firebase/auth'

import type { AccountUser } from '@comfyorg/account-core/session'

export function testFirebaseUser(overrides: Partial<User> = {}): User {
  return {
    uid: 'uid-1',
    displayName: null,
    email: null,
    emailVerified: false,
    isAnonymous: false,
    metadata: {},
    phoneNumber: null,
    photoURL: null,
    providerData: [],
    providerId: 'firebase',
    refreshToken: 'refresh-token',
    tenantId: null,
    delete: vi.fn(async () => {}),
    getIdToken: vi.fn(async () => 'id-token'),
    getIdTokenResult: vi.fn(async () => ({
      token: 'id-token',
      authTime: '',
      issuedAtTime: '',
      expirationTime: '',
      signInProvider: null,
      signInSecondFactor: null,
      claims: {}
    })),
    reload: vi.fn(async () => {}),
    toJSON: () => ({}),
    ...overrides
  }
}

export function testCredential(
  user: User = testFirebaseUser()
): UserCredential {
  return { user, providerId: null, operationType: 'signIn' }
}

export function testUser(uid = 'uid-1'): AccountUser {
  return { uid, getIdToken: vi.fn(async () => 'id-token') }
}

export function mintBody(token: string) {
  return {
    token,
    permissions: ['workspace:read'],
    expires_at: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
    role: 'owner'
  }
}

export function okFetch(token = 'jwt-1') {
  return vi.fn<typeof fetch>(
    async () => new Response(JSON.stringify(mintBody(token)), { status: 200 })
  )
}
