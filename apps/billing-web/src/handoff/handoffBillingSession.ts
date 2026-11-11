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
  endHandoff,
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
    if (handoffTab.value?.kind === 'session')
      endHandoff(storage, 'session_ended')
    return { status: 'error', code: 'NOT_AUTHENTICATED' }
  }

  return {
    getSnapshot,
    subscribe: (listener) =>
      watch(handoffTab, () => listener(getSnapshot()), { flush: 'sync' }),
    ensureFresh: async () => current(),
    remint: async () => {
      if (handoffTab.value?.kind === 'session')
        endHandoff(storage, 'session_ended')
      return { status: 'error', code: 'NOT_AUTHENTICATED' }
    }
  }
}
