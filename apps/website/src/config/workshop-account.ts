/**
 * The Workshop's account-layer wiring: one session client from
 * @comfyorg/account, bound to the env-selected Cloud origin. The credential
 * cache sits in sessionStorage so a token survives a reload but never
 * outlives the tab, and never crosses signed-in users (the client keys it
 * by uid).
 */
import type { User } from 'firebase/auth'

import type { SessionClient } from '@comfyorg/account/core'
import {
  createSessionClient,
  isPermanentSessionError
} from '@comfyorg/account/core'

import {
  captureAuthRefreshFailed,
  captureAuthRefreshSucceeded
} from '../scripts/posthog'
import { WORKSHOP_CLOUD_BASE_URL } from './workshop-env'

const STORAGE_KEY = 'comfy.workshop.session.v1'

const storage = {
  read(): string | null {
    try {
      return globalThis.sessionStorage?.getItem(STORAGE_KEY) ?? null
    } catch {
      // Storage that throws outright (cookies disabled) behaves as no cache.
      return null
    }
  },
  write(value: string): void {
    try {
      globalThis.sessionStorage?.setItem(STORAGE_KEY, value)
    } catch {
      // A session that only lives in memory still works for this page.
    }
  },
  clear(): void {
    try {
      globalThis.sessionStorage?.removeItem(STORAGE_KEY)
    } catch {
      // Nothing to clear if storage is unavailable.
    }
  }
}

export const workshopSessionClient: SessionClient<User> =
  createSessionClient<User>({
    exchangeUrl: `${WORKSHOP_CLOUD_BASE_URL}/api/auth/token`,
    storage
  })

/**
 * Mirrors the cloud app's auth-refresh telemetry so both surfaces feed one
 * PostHog funnel. Only the outcomes this lifecycle can produce are fired:
 * succeeded (deduped per token, since a cached read republishes the same
 * credential) and permanent_failure; the retry outcomes belong to cloud's
 * scheduler-based refresh.
 */
let lastReportedToken: string | undefined
workshopSessionClient.subscribe((snapshot) => {
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
