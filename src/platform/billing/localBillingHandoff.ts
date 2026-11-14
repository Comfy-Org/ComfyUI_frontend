import { combineAbortSignals } from '@comfyorg/api-client/abortSignal'
import type { BillingHandoffCreateRequest } from '@comfyorg/ingest-types'
import {
  zBillingHandoffCreateResponse,
  zErrorResponse
} from '@comfyorg/ingest-types/zod'
import { useTelemetry } from '@comfyorg/telemetry'
import { watch } from 'vue'

import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { getComfyCloudBaseUrl } from '@/config/comfyApi'
import { i18n, t } from '@/i18n'
import {
  desktopHostUser,
  issueDesktopHostBillingHandoff
} from '@/platform/auth/desktopHost/desktopHostSession'
import { refreshBilling } from '@/platform/billing/billingRefresh'
import type { BillingTab } from '@/platform/billing/billingTab'
import { reserveBillingTab } from '@/platform/billing/billingTab'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { localSurface } from '@/platform/billing/localBillingWebEnabled'
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
  | {
      readonly kind: 'refused'
      readonly message: string | undefined
      readonly code: string | undefined
    }

export type BillingHandoffResult =
  | { readonly status: 'ok'; readonly url: string }
  | { readonly status: 'error'; readonly message: string | undefined }

interface HandoffScope {
  readonly userId: string
  readonly workspaceId: string
  readonly cloudBaseUrl: string
}

const UNEXPLAINED_REFUSAL: HandoffIssue = {
  kind: 'refused',
  message: undefined,
  code: undefined
}

async function refusal(response: Response): Promise<HandoffIssue> {
  const body = zErrorResponse.safeParse(await response.json().catch(() => null))
  return body.success
    ? { kind: 'refused', message: body.data.message, code: body.data.code }
    : UNEXPLAINED_REFUSAL
}

function issueBody(
  workspaceId: string,
  request: BillingHandoffRequest
): BillingHandoffCreateRequest {
  return {
    workspace_id: workspaceId,
    receiver: 'billing_web',
    surface: 'local_web',
    intent: request.intent,
    ...('amountCents' in request ? { amount_cents: request.amountCents } : {}),
    client_version: __COMFYUI_FRONTEND_VERSION__.slice(0, 64)
  }
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
      body: JSON.stringify(issueBody(workspaceId, request)),
      signal: combineAbortSignals([
        signal,
        AbortSignal.timeout(ISSUE_TIMEOUT_MS)
      ])
    })
    if (response.status === 401) return { kind: 'sign_in_again' }
    if (!response.ok) return refusal(response)
    const issued = zBillingHandoffCreateResponse.safeParse(
      await response.json()
    )
    return issued.success
      ? { kind: 'issued', entryUrl: issued.data.entry_url }
      : UNEXPLAINED_REFUSAL
  } catch {
    return UNEXPLAINED_REFUSAL
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

interface ScopeWatch {
  readonly changed: () => boolean
  readonly replaced: () => boolean
  readonly stop: () => void
}

function watchScopeChange(): ScopeWatch {
  const started = scopeKey(currentScope())
  let changed = false
  let signedOut = false
  let replaced = false
  const stop = watch(
    () => scopeKey(currentScope()),
    (key) => {
      changed = true
      if (key === '') signedOut = true
      else if (key !== started || signedOut) replaced = true
    },
    { flush: 'sync' }
  )
  return { changed: () => changed, replaced: () => replaced, stop }
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

async function issueThroughDesktop(
  workspaceId: string,
  request: BillingHandoffRequest
): Promise<HandoffIssue> {
  const answer = await issueDesktopHostBillingHandoff(
    workspaceId,
    'billing_web',
    request.intent,
    'amountCents' in request ? request.amountCents : undefined
  )
  switch (answer.status) {
    case 'issued':
      return { kind: 'issued', entryUrl: answer.entryUrl }
    case 'sign_in_again':
      return SIGN_IN_AGAIN
    case 'refused':
      return { kind: 'refused', message: answer.message, code: answer.code }
    case 'disabled':
      return UNEXPLAINED_REFUSAL
  }
}

function refusedOnAbort(signal: AbortSignal): {
  refusal: Promise<HandoffIssue>
  stop: () => void
} {
  let refuse = () => {}
  const refusal = new Promise<HandoffIssue>((resolve) => {
    refuse = () => resolve(UNEXPLAINED_REFUSAL)
  })
  signal.addEventListener('abort', refuse, { once: true })
  return { refusal, stop: () => signal.removeEventListener('abort', refuse) }
}

async function issueThroughDesktopUnlessAbandoned(
  workspaceId: string,
  request: BillingHandoffRequest,
  signal: AbortSignal
): Promise<HandoffIssue> {
  if (signal.aborted) return UNEXPLAINED_REFUSAL
  const abandoned = refusedOnAbort(signal)
  return Promise.race([
    issueThroughDesktop(workspaceId, request),
    abandoned.refusal
  ]).finally(abandoned.stop)
}

async function issueForScope(
  scope: HandoffScope,
  request: BillingHandoffRequest,
  signal: AbortSignal
): Promise<HandoffIssue> {
  if (localSurface() === 'desktop')
    return issueThroughDesktopUnlessAbandoned(
      scope.workspaceId,
      request,
      signal
    )
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

function supersededDuring(issue: HandoffIssue, scopeWatch: ScopeWatch) {
  if (scopeWatch.replaced()) return true
  const endedBySignOut =
    issue.kind === 'sign_in_again' && currentScope() === undefined
  return scopeWatch.changed() && !endedBySignOut
}

function trackIssue(issue: HandoffIssue, scopeChanged: boolean): void {
  const result = scopeChanged
    ? 'superseded'
    : issue.kind === 'issued'
      ? 'opened'
      : issue.kind
  useTelemetry()?.trackBillingEvent({
    operation: 'local_handoff',
    stage: 'launched',
    outcome: result === 'opened' ? 'pending' : 'failed',
    surface: localSurface(),
    result,
    ...(issue.kind === 'refused' && issue.code && { error_code: issue.code })
  })
}

/** The tab a handoff opens in, reserved during the click and showing that checkout is opening. */
export function reserveBillingHandoffTab(): BillingTab | null {
  return reserveBillingTab({
    lang: i18n.global.locale.value,
    title: t('billingHandoff.opening'),
    detail: t('billingHandoff.openingDetail')
  })
}

/** Issues a one-time billing-web handoff for the signed-in local account, through Desktop's bridge on Desktop; the URL works once and is never shown. */
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
    if (signal.aborted) return DISCARDED
    const scopeChanged = supersededDuring(issue, scopeWatch)
    trackIssue(issue, scopeChanged)
    return settle(issue, scopeChanged)
  } finally {
    scopeWatch.stop()
    inFlight = false
  }
}
