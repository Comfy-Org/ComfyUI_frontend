import { watch } from 'vue'
import type { Router } from 'vue-router'

import { t } from '@/i18n'
import {
  clearPreservedQuery,
  getPreservedQueryParam
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { api } from '@/scripts/api'
import { useDialogService } from '@/services/dialogService'
import { useAuthStore } from '@/stores/authStore'

const NAMESPACE = PRESERVED_QUERY_NAMESPACES.DESKTOP_LOGIN
const DESKTOP_LOGIN_CODE_KEY = 'desktop_login_code'

// The backend issues "dlc_" + 43 base64url chars; bounds are loose so the
// backend stays the authority on exact code length.
const DESKTOP_LOGIN_CODE_PATTERN = /^dlc_[A-Za-z0-9_-]{20,256}$/

// Statuses that mean the desktop app must start a fresh sign-in, so the code
// is dropped. 401 stays transient: the session may still be settling.
const TERMINAL_REDEEM_STATUSES = new Set([400, 403, 404, 409, 410])

// One delayed in-page retry, so an approved sign-in always reaches a success
// or failure toast without ever looping within a page load.
const MAX_REDEEM_ATTEMPTS = 2
const RETRY_DELAY_MS = 5_000

// Abort the redeem request if the backend hangs; treated as transient.
const REDEEM_TIMEOUT_MS = 10_000

interface CodeRedemptionState {
  attempts: number
  approvedUserUid: string | null
  settled: boolean
  forceTokenRefresh: boolean
}

// Keyed by code so a different code arriving later gets its own approval and
// attempt budget, while retries of the same code reuse both.
const codeStates = new Map<string, CodeRedemptionState>()

// Coalesces concurrent triggers into one drain; a trigger arriving mid-drain
// (e.g. the auth watcher firing while the dialog is open) is replayed as one
// more pass instead of being dropped.
let draining = false
let retriggerRequested = false

let authWatcherInstalled = false

function getCodeState(code: string): CodeRedemptionState {
  const existing = codeStates.get(code)
  if (existing) return existing
  const fresh = {
    attempts: 0,
    approvedUserUid: null,
    settled: false,
    forceTokenRefresh: false
  }
  codeStates.set(code, fresh)
  return fresh
}

// A newer code can be stashed while an older one is mid-redemption; settling
// the older one must not wipe it.
function clearStashIfHolds(code: string): void {
  if (getPreservedQueryParam(NAMESPACE, DESKTOP_LOGIN_CODE_KEY) === code) {
    clearPreservedQuery(NAMESPACE)
  }
}

function settle(code: string, state: CodeRedemptionState): void {
  state.settled = true
  clearStashIfHolds(code)
}

function handleTransientFailure(
  code: string,
  state: CodeRedemptionState,
  reason: string
): void {
  console.warn(`[DesktopLoginRedemption] Redeem request failed: ${reason}`)
  if (state.attempts < MAX_REDEEM_ATTEMPTS) {
    // attempts only increments, so this branch runs at most once per code
    // and cannot stack retry timers.
    setTimeout(() => {
      void redeemPendingDesktopLoginCode()
    }, RETRY_DELAY_MS)
    return
  }
  // Budget spent: drop the code and tell the user instead of failing silently.
  settle(code, state)
  useToastStore().add({
    severity: 'error',
    summary: t('desktopLogin.failedSummary'),
    detail: t('desktopLogin.failedDetail'),
    life: 6000
  })
}

// Explicit approval defeats device-code phishing: a lured click on a leaked
// link must not bind the victim's session to an attacker's desktop app.
// Approval is per code *and* account.
async function confirmRedemption(
  state: CodeRedemptionState,
  uid: string
): Promise<boolean> {
  if (state.approvedUserUid === uid) return true
  const confirmed = await useDialogService().confirm({
    title: t('desktopLogin.confirmSummary'),
    message: t('desktopLogin.confirmMessage')
  })
  if (confirmed !== true) return false
  state.approvedUserUid = uid
  return true
}

async function redeemCode(code: string): Promise<void> {
  const state = getCodeState(code)
  if (state.settled) {
    // A later navigation can re-capture an already-settled code; drop it.
    clearStashIfHolds(code)
    return
  }

  // No session yet (e.g. code captured on the login page): keep the stash and
  // let a post-login trigger redeem it.
  const user = useAuthStore().currentUser
  if (!user) return

  if (!(await confirmRedemption(state, user.uid))) {
    // Declined/dismissed: drop the code without an error.
    settle(code, state)
    return
  }

  // Approval binds the code to one account: if the session changed while the
  // dialog was open, keep the code stashed and let the (replayed) auth-change
  // trigger re-prompt under the now-current account.
  const approvedUser = useAuthStore().currentUser
  if (!approvedUser || approvedUser.uid !== state.approvedUserUid) return

  state.attempts++

  // Token comes straight from the Firebase user: authStore.getIdToken()
  // surfaces failures through a modal dialog this background flow must avoid.
  let idToken: string
  try {
    idToken = await approvedUser.getIdToken(state.forceTokenRefresh)
  } catch {
    handleTransientFailure(code, state, 'could not get id token')
    return
  }

  let response: Response
  try {
    response = await fetch(api.apiURL('/auth/desktop-login-codes/redeem'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      // TODO(@comfyorg/ingest-types): type the payload with the generated
      // request type once the desktop-login-codes openapi addition propagates.
      body: JSON.stringify({ code }),
      signal: AbortSignal.timeout(REDEEM_TIMEOUT_MS)
    })
  } catch (error) {
    handleTransientFailure(
      code,
      state,
      error instanceof Error && error.name === 'TimeoutError'
        ? 'request timed out'
        : 'network error'
    )
    return
  }

  if (response.ok) {
    settle(code, state)
    useToastStore().add({
      severity: 'success',
      summary: t('desktopLogin.successSummary'),
      detail: t('desktopLogin.successDetail'),
      life: 4000
    })
    return
  }

  if (TERMINAL_REDEEM_STATUSES.has(response.status)) {
    settle(code, state)
    useToastStore().add({
      severity: 'error',
      summary: t('desktopLogin.expiredSummary'),
      detail: t('desktopLogin.expiredDetail'),
      life: 6000
    })
    return
  }

  // A 401 usually means a stale cached id token; mint a fresh one on retry.
  if (response.status === 401) state.forceTokenRefresh = true
  handleTransientFailure(code, state, `status ${response.status}`)
}

async function redeemPendingDesktopLoginCode(): Promise<void> {
  // Never rejects: the triggers fire-and-forget this.
  if (draining) {
    retriggerRequested = true
    return
  }
  draining = true
  try {
    do {
      retriggerRequested = false
      const code = getPreservedQueryParam(NAMESPACE, DESKTOP_LOGIN_CODE_KEY)
      if (!code) continue
      if (!DESKTOP_LOGIN_CODE_PATTERN.test(code)) {
        clearPreservedQuery(NAMESPACE)
        continue
      }
      await redeemCode(code)
      if (code !== getPreservedQueryParam(NAMESPACE, DESKTOP_LOGIN_CODE_KEY))
        retriggerRequested = true
    } while (retriggerRequested)
  } catch (error) {
    console.error('[DesktopLoginRedemption] Redemption failed:', error)
  } finally {
    draining = false
  }
}

function installAuthWatcherOnce(): void {
  if (authWatcherInstalled) return
  authWatcherInstalled = true
  // A session can appear without a navigation (e.g. dialog-based sign-in).
  // Installed lazily because pinia is not active when router.ts evaluates.
  watch(
    () => useAuthStore().currentUser,
    () => {
      void redeemPendingDesktopLoginCode()
    }
  )
}

/**
 * Redeems desktop login codes (`?desktop_login_code=dlc_...`).
 *
 * The desktop app opens the browser with an opaque one-time code and polls
 * the cloud backend; redeeming the code from a signed-in browser session,
 * with the user's approval, releases a one-time custom token to that poll
 * and signs the desktop app in. The preserved-query tracker (configured in
 * router.ts) strips the code from the URL at capture time, so the stash is
 * the only place it lives.
 */
export function installDesktopLoginRedemption(router: Router): void {
  router.afterEach(() => {
    installAuthWatcherOnce()
    void redeemPendingDesktopLoginCode()
  })
}
