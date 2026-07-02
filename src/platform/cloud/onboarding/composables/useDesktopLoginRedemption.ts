import { createSharedComposable, until } from '@vueuse/core'
import { useRoute, useRouter } from 'vue-router'

import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import {
  clearPreservedQuery,
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
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

// Allows one transient-failure retry (e.g. the fresh-login trigger fails and
// the GraphView mount retries) without ever looping within a page load.
const MAX_REDEEM_ATTEMPTS = 2

// Abort the redeem request if the backend hangs; treated as transient.
const REDEEM_TIMEOUT_MS = 10_000

/**
 * Request body for POST /api/auth/desktop-login-codes/redeem.
 *
 * TODO(@comfyorg/ingest-types): replace with the generated request/response
 * types once the cloud openapi.yaml addition for desktop login codes
 * propagates through the push-ingest-types-to-frontend workflow.
 */
interface RedeemDesktopLoginCodePayload {
  code: string
}

/**
 * Strips the desktop login code from an in-app full path (e.g. the
 * previousFullPath post-login redirect target) so the one-time code never
 * re-enters the visible URL after redemption.
 */
export function stripDesktopLoginCodeFromPath(fullPath: string): string {
  let url: URL
  try {
    url = new URL(fullPath, 'http://internal.invalid')
  } catch {
    return fullPath
  }
  if (!url.searchParams.has(DESKTOP_LOGIN_CODE_KEY)) return fullPath
  url.searchParams.delete(DESKTOP_LOGIN_CODE_KEY)
  return `${url.pathname}${url.search}${url.hash}`
}

// Module-scoped so exactly-once semantics survive shared-composable disposal
// and dev double-mounts.
let completed = false
let inFlight: Promise<void> | null = null
let attempts = 0
let userApproved = false

/**
 * One-shot redemption of a desktop login code (`?desktop_login_code=dlc_...`).
 *
 * The desktop app opens the browser with an opaque one-time code; once a
 * Firebase session exists the user is asked to approve the sign-in, and the
 * code is redeemed against the cloud backend, which releases a one-time
 * custom token to the polling desktop app (GTM-93). The code survives
 * login/OAuth redirects via the preserved-query stash and is redeemed at most
 * once per page load, from whichever trigger fires first: fresh login
 * (usePostAuthRedirect) or GraphView mount (useUrlActionLoaders).
 */
function useDesktopLoginRedemptionInternal() {
  if (!isCloud) {
    return { redeemIfPresent: async () => {} }
  }

  const route = useRoute()
  const router = useRouter()
  const authStore = useAuthStore()
  const toastStore = useToastStore()
  const dialogService = useDialogService()

  // Strip the raw code from the visible URL; the sessionStorage stash keeps
  // it through auth redirects.
  const stripCodeFromUrl = () => {
    if (route.query[DESKTOP_LOGIN_CODE_KEY] === undefined) return
    const cleanQuery = { ...route.query }
    delete cleanQuery[DESKTOP_LOGIN_CODE_KEY]
    router.replace({ query: cleanQuery }).catch(() => {
      console.warn('[DesktopLoginRedemption] Failed to clean URL params')
    })
  }

  const readCodeFromIntent = (): string | null => {
    hydratePreservedQuery(NAMESPACE)
    const query =
      mergePreservedQueryIntoQuery(NAMESPACE, route.query) ?? route.query
    const code = query[DESKTOP_LOGIN_CODE_KEY]

    if (typeof code !== 'string' || !code) return null
    if (!DESKTOP_LOGIN_CODE_PATTERN.test(code)) {
      clearPreservedQuery(NAMESPACE)
      return null
    }
    return code
  }

  const giveUp = () => {
    completed = true
    clearPreservedQuery(NAMESPACE)
  }

  const handleTransientFailure = (reason: string) => {
    // Keep the stash so the next trigger can retry once; once the attempt
    // budget for this page load is spent, drop the stash too so reloads of
    // this tab never retry a dead code.
    if (attempts >= MAX_REDEEM_ATTEMPTS) giveUp()
    console.warn(`[DesktopLoginRedemption] Redeem request failed: ${reason}`)
  }

  // A leaked link carrying a code must not silently bind the victim's session
  // to an attacker's desktop app: redemption requires explicit approval,
  // asked at most once per page load.
  const confirmRedemption = async (): Promise<boolean> => {
    if (userApproved) return true
    const confirmed = await dialogService.confirm({
      title: t('desktopLogin.confirmSummary'),
      message: t('desktopLogin.confirmMessage')
    })
    userApproved = confirmed === true
    return userApproved
  }

  const redeemOnce = async (): Promise<void> => {
    const code = readCodeFromIntent()
    if (!code) return

    await until(() => authStore.isInitialized).toBe(true)
    // No session yet (e.g. code captured on the login page): keep the stash
    // and let the post-login trigger redeem it.
    const user = authStore.currentUser
    if (!user) return

    if (!(await confirmRedemption())) {
      // Declined/dismissed: drop the code without an error.
      giveUp()
      return
    }

    attempts++

    // Fetch the token straight from the Firebase user: authStore.getIdToken()
    // surfaces failures through a modal error dialog, which this background
    // flow must not trigger.
    let idToken: string
    try {
      idToken = await user.getIdToken()
    } catch {
      handleTransientFailure('could not get id token')
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
        body: JSON.stringify({ code } satisfies RedeemDesktopLoginCodePayload),
        signal: AbortSignal.timeout(REDEEM_TIMEOUT_MS)
      })
    } catch (error) {
      handleTransientFailure(
        error instanceof Error && error.name === 'TimeoutError'
          ? 'request timed out'
          : 'network error'
      )
      return
    }

    if (response.ok) {
      completed = true
      clearPreservedQuery(NAMESPACE)
      toastStore.add({
        severity: 'success',
        summary: t('desktopLogin.successSummary'),
        detail: t('desktopLogin.successDetail'),
        life: 4000
      })
      return
    }

    if (TERMINAL_REDEEM_STATUSES.has(response.status)) {
      completed = true
      clearPreservedQuery(NAMESPACE)
      toastStore.add({
        severity: 'error',
        summary: t('desktopLogin.expiredSummary'),
        detail: t('desktopLogin.expiredDetail'),
        life: 6000
      })
      return
    }

    handleTransientFailure(`status ${response.status}`)
  }

  const redeemIfPresent = async (): Promise<void> => {
    // The code must never linger in the visible URL, even when redemption is
    // already settled (e.g. a previousFullPath redirect resurrecting it).
    stripCodeFromUrl()
    if (completed) {
      clearPreservedQuery(NAMESPACE)
      return
    }
    inFlight ??= redeemOnce().finally(() => {
      inFlight = null
    })
    await inFlight
  }

  return { redeemIfPresent }
}

export const useDesktopLoginRedemption = createSharedComposable(
  useDesktopLoginRedemptionInternal
)
