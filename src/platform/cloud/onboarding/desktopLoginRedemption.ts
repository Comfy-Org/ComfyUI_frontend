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

// Rejected (400/403), unknown/expired (404/410), or redeemed by a different
// user (409) means the desktop app must start a fresh sign-in, so the code is
// dropped. 401 stays transient: the session may still be settling post-login.
const TERMINAL_REDEEM_STATUSES = new Set([400, 403, 404, 409, 410])

// Allows one transient-failure retry without ever looping within a page load.
const MAX_REDEEM_ATTEMPTS = 2

// One bounded in-page retry so an approved sign-in always reaches success or
// the failure toast without needing another navigation or auth change.
const RETRY_DELAY_MS = 5_000

// Abort the redeem request if the backend hangs; treated as transient.
const REDEEM_TIMEOUT_MS = 10_000

interface CodeRedemptionState {
  attempts: number
  approvedUserUid: string | null
  settled: boolean
}

// Keyed by code so a different code arriving later gets its own approval and
// attempt budget, while retries of the same code reuse both.
const codeStates = new Map<string, CodeRedemptionState>()

// Coalesces concurrent triggers (afterEach can burst) into one drain.
let draining = false

let authWatcherInstalled = false

function getCodeState(code: string): CodeRedemptionState {
  const existing = codeStates.get(code)
  if (existing) return existing
  const fresh = { attempts: 0, approvedUserUid: null, settled: false }
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
  // The budget is spent on a sign-in the user explicitly approved: drop the
  // stash so reloads never retry a dead code, and tell the user instead of
  // failing silently.
  settle(code, state)
  useToastStore().add({
    severity: 'error',
    summary: t('desktopLogin.failedSummary'),
    detail: t('desktopLogin.failedDetail'),
    life: 6000
  })
}

// A leaked link carrying a code must not silently bind the victim's session
// to an attacker's desktop app: redemption requires explicit approval.
// Approval is per code *and* account — retries of the same code under the
// same account reuse it, but a different code, or the same code under a
// different account, must be approved on its own.
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

  // The session can change while the dialog is open or between a transient
  // failure and its retry: approval binds the code to one account, so redeem
  // only while that exact account is still active. On mismatch the code stays
  // stashed and the next trigger re-prompts under the now-current account.
  const approvedUser = useAuthStore().currentUser
  if (!approvedUser || approvedUser.uid !== state.approvedUserUid) return

  state.attempts++

  // Fetch the token straight from the Firebase user: authStore.getIdToken()
  // surfaces failures through a modal error dialog, which this background
  // flow must not trigger.
  let idToken: string
  try {
    idToken = await approvedUser.getIdToken()
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

  handleTransientFailure(code, state, `status ${response.status}`)
}

async function redeemPendingDesktopLoginCode(): Promise<void> {
  // Never rejects: the triggers fire-and-forget this and must not be derailed
  // by a redemption failure.
  if (draining) return
  draining = true
  try {
    // A newer code can replace the stashed one while an older redemption is
    // mid-flight (its trigger lands here while draining and returns), so after
    // each pass process whatever the stash holds now. A pass that leaves its
    // own code stashed — a transient failure awaiting its retry timer, or an
    // account mismatch awaiting the next trigger — ends the drain.
    let processedCode: string | undefined
    for (;;) {
      const code = getPreservedQueryParam(NAMESPACE, DESKTOP_LOGIN_CODE_KEY)
      if (!code || code === processedCode) return
      if (!DESKTOP_LOGIN_CODE_PATTERN.test(code)) {
        clearPreservedQuery(NAMESPACE)
        return
      }
      processedCode = code
      await redeemCode(code)
    }
  } catch (error) {
    console.error('[DesktopLoginRedemption] Redemption failed:', error)
  } finally {
    draining = false
  }
}

function installAuthWatcherOnce(): void {
  if (authWatcherInstalled) return
  authWatcherInstalled = true
  // A session can appear without a navigation (the OAuth-resume error branch
  // parks the user on the login view with a live session; dialog-based
  // sign-in), so navigations alone would miss it. Installed on the first
  // afterEach because pinia is not yet active when router.ts evaluates.
  watch(
    () => useAuthStore().currentUser,
    () => {
      void redeemPendingDesktopLoginCode()
    }
  )
}

/**
 * Redemption of desktop login codes (`?desktop_login_code=dlc_...`).
 *
 * The desktop app opens the browser with an opaque one-time code; once a
 * Firebase session exists the user is asked to approve the sign-in, and the
 * code is redeemed against the cloud backend, which releases a one-time
 * custom token to the polling desktop app (GTM-93). The preserved-query
 * tracker strips the code from the URL at capture time, so the stash is the
 * only place it lives. Redemption is attempted after every completed
 * navigation, whenever the auth session changes, and once more on a delayed
 * retry after a transient failure; a code with no session yet stays stashed
 * until one of those triggers finds a signed-in user.
 */
export function installDesktopLoginRedemption(router: Router): void {
  router.afterEach(() => {
    installAuthWatcherOnce()
    void redeemPendingDesktopLoginCode()
  })
}
