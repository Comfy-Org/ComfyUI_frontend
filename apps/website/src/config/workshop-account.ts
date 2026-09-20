/**
 * The Workshop's account-layer wiring: one session client from
 * @comfyorg/account-core, bound to the env-selected Cloud origin, and the
 * site-owned balance reader over it. The credential
 * cache sits in sessionStorage so a token survives a reload but never
 * outlives the tab, and never crosses signed-in users (the client keys it
 * by uid).
 */
import type { User } from 'firebase/auth'

import type { LazyIdentity } from '@comfyorg/account-core/lazyIdentity'
import { createLazyIdentity } from '@comfyorg/account-core/lazyIdentity'
import type { SessionClient } from '@comfyorg/account-core/session'
import {
  createSessionClient,
  isPermanentSessionError
} from '@comfyorg/account-core/session'

import {
  captureAuthRefreshFailed,
  captureAuthRefreshSucceeded
} from '../scripts/posthog'
import { createBalanceReader } from './workshop-balance'
import { WORKSHOP_CLOUD_BASE_URL } from './workshop-env'

export const STORAGE_KEY = 'comfy.workshop.session.v1'

const storage = {
  read(): string | null {
    try {
      return globalThis.sessionStorage.getItem(STORAGE_KEY)
    } catch {
      // Storage that throws outright (cookies disabled) behaves as no cache.
      return null
    }
  },
  write(value: string): void {
    try {
      globalThis.sessionStorage.setItem(STORAGE_KEY, value)
    } catch {
      // A session that only lives in memory still works for this page.
    }
  },
  clear(): void {
    try {
      globalThis.sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // Nothing to clear if storage is unavailable.
    }
  }
}

/** Activated by the session lifecycle; the Firebase chunk loads only then. */
export const workshopIdentity: LazyIdentity<User> = createLazyIdentity<User>(
  () =>
    import('./workshop-firebase').then((firebase) => firebase.workshopIdentity)
)

export const workshopSessionClient: SessionClient<User> =
  createSessionClient<User>(
    {
      exchangeUrl: `${WORKSHOP_CLOUD_BASE_URL}/api/auth/token`,
      storage
    },
    workshopIdentity
  )

export const workshopBalanceReader = createBalanceReader(
  workshopSessionClient,
  `${WORKSHOP_CLOUD_BASE_URL}/api/billing/balance`
)

/**
 * Mirrors the cloud app's auth-refresh telemetry so both surfaces feed one
 * PostHog funnel. Only the outcomes this lifecycle can produce are fired:
 * succeeded (deduped per token, since a cached read republishes the same
 * credential) and permanent_failure; the retry outcomes belong to cloud's
 * scheduler-based refresh.
 */
export function subscribeAuthRefreshTelemetry(): () => void {
  let lastReportedToken: string | undefined
  return workshopSessionClient.subscribe((snapshot) => {
    if (snapshot.phase === 'authenticated') {
      if (snapshot.session.token === lastReportedToken) return
      lastReportedToken = snapshot.session.token
      captureAuthRefreshSucceeded()
      return
    }
    if (snapshot.phase === 'signed-out') {
      lastReportedToken = undefined
      return
    }
    if (
      snapshot.phase === 'error' &&
      isPermanentSessionError(snapshot.failure.code)
    ) {
      captureAuthRefreshFailed('permanent_failure')
    }
  })
}
