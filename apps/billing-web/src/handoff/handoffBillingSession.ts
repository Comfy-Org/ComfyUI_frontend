import { watch } from 'vue'

import type {
  AccountCredential,
  AccountUser,
  SessionResult,
  SessionSnapshot
} from '@comfyorg/account-core/session'
import type { BillingSession } from '@comfyorg/account-core/billing'

import type { HandoffSession, TabStorage } from '@/handoff/handoffTab'
import {
  endHandoffSession,
  handoffTab,
  liveHandoffSession
} from '@/handoff/handoffTab'

function credentialOf(session: HandoffSession): AccountCredential {
  return {
    token: session.token,
    expiresAt: session.expiresAt,
    uid: session.userId,
    workspace: session.workspace,
    role: session.role,
    permissions: []
  }
}

function userOf(session: HandoffSession): AccountUser {
  return {
    uid: session.userId,
    getIdToken: () =>
      Promise.reject(new Error('A billing handoff tab has no ID token'))
  }
}

/**
 * The scoped session as a billing session: never minted or refreshed. A 401
 * the transport retries through `remint` ends the tab's handoff.
 */
export function createHandoffBillingSession(
  storage: TabStorage,
  now: () => number = () => Date.now()
): BillingSession {
  function getSnapshot(): SessionSnapshot {
    const session = liveHandoffSession(now())
    return session
      ? {
          phase: 'authenticated',
          user: userOf(session),
          session: credentialOf(session)
        }
      : { phase: 'signed-out', user: null, session: undefined }
  }

  function current(): SessionResult | undefined {
    const session = liveHandoffSession(now())
    if (session) return { status: 'ok', session: credentialOf(session) }
    endHandoffSession(storage, now)
    return { status: 'error', code: 'NOT_AUTHENTICATED' }
  }

  return {
    getSnapshot,
    subscribe: (listener) =>
      watch(handoffTab, () => listener(getSnapshot()), { flush: 'sync' }),
    ensureFresh: async () => current(),
    remint: async () => {
      endHandoffSession(storage, now)
      return { status: 'error', code: 'NOT_AUTHENTICATED' }
    }
  }
}
