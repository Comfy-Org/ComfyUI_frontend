import { combineAbortSignals } from '@comfyorg/api-client/abortSignal'
import {
  zBillingHandoffCreateResponse,
  zErrorResponse
} from '@comfyorg/ingest-types/zod'
import { watch } from 'vue'

import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { getComfyCloudBaseUrl } from '@/config/comfyApi'
import { t } from '@/i18n'
import { desktopHostUser } from '@/platform/auth/desktopHost/desktopHostSession'
import { refreshBilling } from '@/platform/billing/billingRefresh'
import type { BillingTab } from '@/platform/billing/billingTab'
import { reserveBillingTab } from '@/platform/billing/billingTab'
import {
  localSurface,
  useLocalBillingWebFlagStore
} from '@/platform/billing/stores/localBillingWebFlagStore'
import { isCloud } from '@/platform/distribution/types'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { registerRefreshOnReturn } from '@/platform/billing/refreshOnReturn'
import { useWorkspaceIdentity } from '@/platform/workspace/ports/workspaceIdentity'
import { useAuthStore } from '@/stores/authStore'

const ISSUE_TIMEOUT_MS = 15_000

/** The billing flow the user started, which billing-web opens after the exchange. */
export type BillingHandoffRequest =
  | { readonly intent: 'top-up'; readonly amountCents: number }
  | { readonly intent: 'subscription' }

type HandoffIssue =
  | { readonly kind: 'issued'; readonly entryUrl: string }
  | { readonly kind: 'sign_in_again' }
  | { readonly kind: 'refused'; readonly message: string | undefined }

export type BillingHandoffResult =
  | { readonly status: 'ok'; readonly url: string }
  | { readonly status: 'error'; readonly message: string | undefined }

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
  cloudBaseUrl: string,
  request: BillingHandoffRequest,
  signal: AbortSignal
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
        intent: request.intent,
        ...('amountCents' in request
          ? { amount_cents: request.amountCents }
          : {}),
        client_version: __COMFYUI_FRONTEND_VERSION__.slice(0, 64)
      }),
      signal: combineAbortSignals([
        signal,
        AbortSignal.timeout(ISSUE_TIMEOUT_MS)
      ])
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

const DISCARDED: BillingHandoffResult = { status: 'error', message: undefined }

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

async function issueForScope(
  scope: HandoffScope,
  request: BillingHandoffRequest,
  signal: AbortSignal
): Promise<HandoffIssue> {
  const token = await useAuthStore().getIdToken()
  if (!token) return SIGN_IN_AGAIN
  return issueBillingHandoff(
    token,
    scope.workspaceId,
    scope.cloudBaseUrl,
    request,
    signal
  )
}

function settle(
  issue: HandoffIssue,
  scopeChanged: boolean
): BillingHandoffResult {
  if (scopeChanged)
    return { status: 'error', message: t('billingHandoff.superseded') }
  if (issue.kind === 'issued') {
    armReturnRefresh()
    return { status: 'ok', url: issue.entryUrl }
  }
  if (issue.kind === 'refused')
    return { status: 'error', message: issue.message }
  void useAuthDialogs().showSignInDialog()
  return { status: 'error', message: t('billingHandoff.signInAgain') }
}

/** True where Add credits pays through a billing-web handoff instead of a Cloud checkout. */
export function opensLocalBillingHandoff(): boolean {
  return (
    !isCloud &&
    localSurface() === 'local_web' &&
    useLocalBillingWebFlagStore().enabled
  )
}

/** The tab a handoff opens in, reserved during the click and showing that checkout is opening. */
export function reserveBillingHandoffTab(): BillingTab | null {
  return reserveBillingTab({
    title: t('billingHandoff.opening'),
    detail: t('billingHandoff.openingDetail')
  })
}

/** Issues a one-time billing-web handoff for the signed-in local web account; the URL works once and is never shown. */
export async function issueLocalBillingHandoff(
  request: BillingHandoffRequest,
  signal: AbortSignal
): Promise<BillingHandoffResult> {
  if (inFlight) return DISCARDED
  const scope = currentScope()
  const scopeWatch = watchScopeChange()
  inFlight = true
  try {
    const issue = scope
      ? await issueForScope(scope, request, signal)
      : SIGN_IN_AGAIN
    return signal.aborted ? DISCARDED : settle(issue, scopeWatch.changed())
  } finally {
    scopeWatch.stop()
    inFlight = false
  }
}
