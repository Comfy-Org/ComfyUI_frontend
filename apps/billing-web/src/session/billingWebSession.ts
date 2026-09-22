/**
 * The hosted billing origin's own session: one session client from
 * `@comfyorg/account-core`, bound to the env-selected Cloud origin, with the
 * Firebase identity of this origin attached.
 *
 * The credential cache sits in sessionStorage so a token survives a reload
 * but never outlives the tab, and never crosses signed-in users — the client
 * keys it by uid.
 *
 * `useBillingWebSession` projects the client's one `SessionSnapshot` as
 * reactive state, so the illegal combinations parallel refs could hold cannot
 * occur. `phase === 'pending'` is "Firebase has not answered yet", distinct
 * from a signed-out `null`. A caller that needs a token still awaits
 * `ensureFresh()` immediately before use.
 *
 * The identity behind the session is a lazy one: `resolveBillingWebIdentity`
 * resolves the config asynchronously (runtime fetch, then build-time
 * fallback), so the client subscribes at module load while `pending` covers
 * the wait. This module is the single owner of `activate()` /
 * `deactivate()` — the lazy port is single-owner, and `listen()` is already
 * the one gate that starts it.
 */
import type { User } from 'firebase/auth'
import { computed, shallowRef } from 'vue'

import type {
  SessionClient,
  SessionSnapshot
} from '@comfyorg/account-core/session'
import { createSessionClient } from '@comfyorg/account-core/session'
import {
  createLazyIdentity,
  createUnavailableIdentity
} from '@comfyorg/account-core/lazyIdentity'

import { CLOUD_BASE_URL } from '@/config/env'
import { resolveBillingWebIdentity } from '@/config/firebase'

/**
 * Script-readable by design: an injected script on this origin could read the
 * cached credential, but it could equally mint a fresh one from the identity it
 * would already control, so memory-only storage moves the exposure rather than
 * removing it. What bounds the damage is the credential's own lifetime, which
 * is short, tab-scoped and keyed by uid, as the Cloud app caches it too.
 */
const STORAGE_KEY = 'comfy.billing-web.session.v1'

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
      // A session that only lives in memory still works for this tab.
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

/**
 * Deferred until `activate()`: resolving the config and constructing the
 * real Firebase identity happens only once this module starts listening, not
 * at import time.
 */
const billingWebSessionIdentity = createLazyIdentity<User>(async () => {
  const identity = await resolveBillingWebIdentity()
  // No runtime config and no build-time fallback: settle signed-out instead
  // of leaving the session waiting on an identity that will never arrive.
  return identity ?? createUnavailableIdentity<User>()
})

let client: SessionClient<User> | undefined

export function billingWebSessionClient(): SessionClient<User> {
  client ??= createSessionClient<User>(
    { exchangeUrl: `${CLOUD_BASE_URL}/api/auth/token`, storage },
    billingWebSessionIdentity
  )
  return client
}

const PENDING: SessionSnapshot<User> = {
  phase: 'pending',
  user: null,
  session: undefined
}

const snapshot = shallowRef<SessionSnapshot<User>>(PENDING)
let listening = false

function listen(): void {
  if (listening) return
  listening = true
  const session = billingWebSessionClient()
  session.subscribe((next) => {
    snapshot.value = next
  })
  // Single owner of activate(): this is the one gate that starts the lazy
  // identity, bounded by the config fetch's own timeout, so `pending` always
  // resolves to a definite phase.
  void billingWebSessionIdentity.activate()
}

/** The router guard's read; starts the identity listener on first call. */
export function billingWebSessionPhase(): SessionSnapshot<User>['phase'] {
  listen()
  return snapshot.value.phase
}

export function useBillingWebSession() {
  listen()
  return {
    phase: computed(() => snapshot.value.phase),
    user: computed(() => snapshot.value.user),
    session: computed(() =>
      snapshot.value.phase === 'authenticated'
        ? snapshot.value.session
        : undefined
    )
  }
}
