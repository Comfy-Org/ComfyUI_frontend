import { createTestIdentity } from '@comfyorg/account-core/testing'
import type { User } from 'firebase/auth'
import { vi } from 'vitest'

import type * as realAccount from '../workshop-account'

type Account = typeof realAccount
type SessionClient = Account['workshopSessionClient']
type BalanceReader = Account['workshopBalanceReader']
type BalanceState = ReturnType<BalanceReader['getState']>

const signedOut = {
  phase: 'signed-out',
  user: null,
  session: undefined
} as const

const identity = createTestIdentity<User>({
  onUserChanged(callback) {
    callback(null)
    return () => {}
  }
})

const identityMock: Account['workshopIdentity'] = {
  ...identity,
  activate: vi.fn(async () => {}),
  deactivate: vi.fn()
}

const sessionClientMock = vi.mockObject<SessionClient>(
  {
    dispose: () => {},
    getSnapshot: () => signedOut,
    subscribe: (callback) => {
      callback(signedOut)
      return () => {}
    },
    getToken: () => undefined,
    ensureFresh: async () => undefined,
    remint: async () => undefined,
    invalidate: () => {},
    clearStoredCredential: () => {}
  },
  { spy: true }
)

const balanceReaderMock = vi.mockObject<BalanceReader>(
  {
    getState: (): BalanceState => ({ status: 'unknown' }),
    subscribe: (callback) => {
      callback({ status: 'unknown' })
      return () => {}
    },
    refresh: async () => {},
    reset: () => {}
  },
  { spy: true }
)

const account: Account = {
  STORAGE_KEY: 'comfy.workshop.session.v1',
  workshopIdentity: identityMock,
  workshopSessionClient: sessionClientMock,
  workshopBalanceReader: balanceReaderMock,
  subscribeAuthRefreshTelemetry: vi.fn(() => () => {})
}

export const {
  STORAGE_KEY,
  workshopIdentity,
  workshopSessionClient,
  workshopBalanceReader,
  subscribeAuthRefreshTelemetry
} = account
