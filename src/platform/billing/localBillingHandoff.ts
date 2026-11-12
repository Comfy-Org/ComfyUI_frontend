import {
  zBillingHandoffCreateResponse,
  zErrorResponse
} from '@comfyorg/ingest-types/zod'
import { watch } from 'vue'

import { useToast } from '@/components/ui/toast/toastStore'
import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { getComfyCloudBaseUrl } from '@/config/comfyApi'
import { t } from '@/i18n'
import { desktopHostUser } from '@/platform/auth/desktopHost/desktopHostSession'
import { refreshBilling } from '@/platform/billing/billingRefresh'
import type { BillingTab } from '@/platform/billing/billingTab'
import { reserveBillingTab } from '@/platform/billing/billingTab'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { registerRefreshOnReturn } from '@/platform/billing/refreshOnReturn'
import { useWorkspaceIdentity } from '@/platform/workspace/ports/workspaceIdentity'
import { useAuthStore } from '@/stores/authStore'

const ISSUE_TIMEOUT_MS = 15_000

type HandoffIssue =
  | { readonly kind: 'issued'; readonly entryUrl: string }
  | { readonly kind: 'sign_in_again' }
  | { readonly kind: 'refused'; readonly message: string | undefined }

export type HandoffLaunch =
  | 'opened'
  | 'busy'
  | 'blocked'
  | 'superseded'
  | 'sign_in_again'
  | 'refused'

interface HandoffScope {
  readonly userId: string
  readonly workspaceId: string
  readonly cloudBaseUrl: string
}

async function serverMessage(response: Response): Promise<string | undefined> {
  const body = zErrorResponse.safeParse(await response.json().catch(() => null))
  return body.success ? body.data.message : undefined
}

async function issueBillingHandoff(
  token: string,
  workspaceId: string,
  cloudBaseUrl: string
): Promise<HandoffIssue> {
  try {
    const response = await fetch(new URL('/api/auth/handoffs', cloudBaseUrl), {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        receiver: 'billing_web',
        surface: 'local_web',
        client_version: __COMFYUI_FRONTEND_VERSION__.slice(0, 64)
      }),
      signal: AbortSignal.timeout(ISSUE_TIMEOUT_MS)
    })
    if (response.status === 401) return { kind: 'sign_in_again' }
    if (!response.ok)
      return { kind: 'refused', message: await serverMessage(response) }
    const issued = zBillingHandoffCreateResponse.safeParse(
      await response.json()
    )
    return issued.success
      ? { kind: 'issued', entryUrl: issued.data.entry_url }
      : { kind: 'refused', message: undefined }
  } catch {
    return { kind: 'refused', message: undefined }
  }
}

function currentScope(): HandoffScope | undefined {
  const userId = useAuthStore().userId
  const workspaceId =
    useWorkspaceIdentity().activeWorkspaceId ??
    desktopHostUser.value?.workspaceId
  if (!userId || !workspaceId) return undefined
  return { userId, workspaceId, cloudBaseUrl: getComfyCloudBaseUrl() }
}

const SIGN_IN_AGAIN: HandoffIssue = { kind: 'sign_in_again' }

function scopeKey(scope: HandoffScope | undefined): string {
  return scope
    ? `${scope.userId} ${scope.workspaceId} ${scope.cloudBaseUrl}`
    : ''
}

function watchScopeChange(): { changed: () => boolean; stop: () => void } {
  let changed = false
  const stop = watch(
    () => scopeKey(currentScope()),
    () => {
      changed = true
    },
    { flush: 'sync' }
  )
  return { changed: () => changed, stop }
}

let inFlight = false
let stopReturnRefresh: (() => void) | null = null

function armReturnRefresh(): void {
  stopReturnRefresh?.()
  stopReturnRefresh = registerRefreshOnReturn(() =>
    Promise.allSettled([
      refreshBilling('account'),
      useBillingCapabilities().refresh()
    ])
  )
}

async function issueForScope(scope: HandoffScope): Promise<HandoffIssue> {
  const token = await useAuthStore().getIdToken()
  if (!token) return SIGN_IN_AGAIN
  return issueBillingHandoff(token, scope.workspaceId, scope.cloudBaseUrl)
}

function settle(
  tab: BillingTab,
  issue: HandoffIssue,
  scopeChanged: boolean
): HandoffLaunch {
  if (scopeChanged) {
    tab.close()
    useToast().error(t('billingHandoff.superseded'))
    return 'superseded'
  }
  if (issue.kind === 'issued') {
    tab.navigate(issue.entryUrl)
    armReturnRefresh()
    return 'opened'
  }
  tab.close()
  if (issue.kind === 'sign_in_again') {
    useToast().error(t('billingHandoff.signInAgain'))
    void useAuthDialogs().showSignInDialog()
    return 'sign_in_again'
  }
  useToast().error(issue.message ?? t('billingHandoff.failed'))
  return 'refused'
}

/** Opens billing-web for the signed-in local web account through a one-time handoff; `retry` re-enters the caller's gate after a blocked pop-up. */
export async function launchLocalBillingHandoff(
  retry: () => void
): Promise<HandoffLaunch> {
  if (inFlight) return 'busy'
  const tab = reserveBillingTab()
  if (!tab) {
    useToast().error(t('billingHandoff.popupBlocked'), {
      action: { label: t('billingHandoff.openBilling'), onClick: retry }
    })
    return 'blocked'
  }
  const scope = currentScope()
  const scopeWatch = watchScopeChange()
  inFlight = true
  try {
    const issue = scope ? await issueForScope(scope) : SIGN_IN_AGAIN
    return settle(tab, issue, scopeWatch.changed())
  } finally {
    scopeWatch.stop()
    inFlight = false
  }
}
