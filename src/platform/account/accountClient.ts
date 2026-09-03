import {
  AccountLayerReadinessTimeoutError,
  AccountError,
  MalformedResponseError,
  createBillingApiClient,
  createBillingCommands,
  createBillingClient,
  createSessionClient
} from '@comfyorg/account/core'
import type {
  AccountHostAdapter,
  AccountLayerOperationRecord,
  AccountLayerPocSeam,
  BillingBalanceResponse,
  BillingClient,
  BillingCommands,
  BillingOperationResponse,
  BillingState,
  SessionClient,
  StorageKey,
  TransportRequest,
  WorkspaceCredential
} from '@comfyorg/account/core'
import { signOut } from 'firebase/auth'
import type { Auth } from 'firebase/auth'
import { readonly, shallowRef } from 'vue'

import { workspaceApiUrl } from '@/platform/workspace/api/workspaceApiUrl'

const namespace = 'comfyui-frontend-account-layer-poc'
const readinessTimeoutMs = 10_000

async function waitUntilAuthenticated(
  session: SessionClient,
  timeoutMs = readinessTimeoutMs
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const phase = session.getState().phase
    if (phase === 'authenticated' || phase === 'refreshing') return
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new AccountLayerReadinessTimeoutError(timeoutMs)
}

export interface AccountLayerPocDebug extends Partial<AccountLayerPocSeam> {
  billingRequests: number
  sessionExchanges: number
  lastBillingToken: string | null
  lastSessionToken: string | null
  lastBillingSessionExchange: number | null
  credentialLifetimeMs: number | null
  refreshScheduleDelayMs: number | null
  billingPosts: number
  openUrlCalls: number
  lastCheckoutUrl: string | null
  lastOpenedUrl: string | null
  payment: BillingState
  operationStore: { activeId: string | null }
  injectOperationResponse(response: BillingOperationResponse): Promise<void>
  showBillingModal(): void
  refreshCredits(): Promise<void>
  runScheduledRefresh(): void
  signOut(): Promise<void>
}

declare global {
  interface Window {
    __accountLayerPoc: Readonly<AccountLayerPocDebug>
  }
}

const debug: AccountLayerPocDebug = {
  billingRequests: 0,
  sessionExchanges: 0,
  lastBillingToken: null,
  lastSessionToken: null,
  lastBillingSessionExchange: null,
  credentialLifetimeMs: null,
  refreshScheduleDelayMs: null,
  billingPosts: 0,
  openUrlCalls: 0,
  lastCheckoutUrl: null,
  lastOpenedUrl: null,
  payment: { step: 'select', noChargeConfirmed: false },
  operationStore: { activeId: null },
  injectOperationResponse: async () => undefined,
  showBillingModal: () => undefined,
  refreshCredits: async () => undefined,
  runScheduledRefresh: () => undefined,
  signOut: async () => undefined
}

let scheduledRefresh: (() => void) | undefined
let injectedOperationResponse: BillingOperationResponse | undefined
let billingCommands: BillingCommands | undefined
const exchangeError = shallowRef<Error | null>(null)

export const accountLayerPocExchangeError = readonly(exchangeError)

export function setAccountLayerPocExchangeError(error: unknown) {
  exchangeError.value =
    error instanceof Error ? error : new Error('Account exchange failed')
}

export function clearAccountLayerPocExchangeError() {
  exchangeError.value = null
}

function storageName(key: StorageKey): string {
  return `${key.namespace}:${key.userId}:${key.workspaceId}`
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') throw new MalformedResponseError()
  return value as Record<string, unknown>
}

function decodeCredential(value: unknown): WorkspaceCredential {
  const input = record(value)
  const workspace = record(input.workspace)
  const expiresAt =
    typeof input.expires_at === 'string'
      ? new Date(input.expires_at).getTime()
      : Number.NaN
  if (
    typeof input.token !== 'string' ||
    typeof workspace.id !== 'string' ||
    !Number.isFinite(expiresAt)
  ) {
    throw new MalformedResponseError()
  }
  debug.sessionExchanges++
  debug.lastSessionToken = input.token
  debug.credentialLifetimeMs = expiresAt - Date.now()
  return { token: input.token, workspaceId: workspace.id, expiresAt }
}

function decodeBalance(value: unknown): BillingBalanceResponse {
  const input = record(value)
  if (typeof input.effective_balance_micros !== 'number') {
    throw new MalformedResponseError()
  }
  debug.billingRequests++
  return { balance: input.effective_balance_micros }
}

async function responseBody(response: Response): Promise<unknown> {
  return await response.json().catch(() => null)
}

function createFrontendAccountAdapter(
  auth: Auth,
  getActiveWorkspace: () => string | null
): AccountHostAdapter {
  return {
    namespace,
    scheduler: {
      now: Date.now,
      schedule: (fn, delayMs) => {
        scheduledRefresh = fn
        debug.refreshScheduleDelayMs = delayMs
        return setTimeout(fn, delayMs)
      },
      cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)
    },
    async acquireIdentity(options) {
      const user = auth.currentUser
      if (!user) return null
      return {
        userId: user.uid,
        token: await user.getIdToken(options?.forceRefresh ?? false)
      }
    },
    getActiveWorkspace,
    storage: {
      async read(key) {
        const value = sessionStorage.getItem(storageName(key))
        return value === null ? null : JSON.parse(value)
      },
      async write(key, value) {
        sessionStorage.setItem(storageName(key), JSON.stringify(value))
      },
      async clear(key) {
        sessionStorage.removeItem(storageName(key))
      }
    },
    operations: {
      exchange: {
        idempotent: true,
        makeRequest: ({ identity, workspaceId }, signal) => ({
          method: 'POST',
          path: workspaceApiUrl('/auth/token'),
          headers: {
            Authorization: `Bearer ${identity.token}`,
            'Content-Type': 'application/json'
          },
          body: {
            identityToken: identity.token,
            workspaceId,
            workspace_id: workspaceId
          },
          signal
        }),
        response: { decode: decodeCredential },
        mapError: (status) =>
          new AccountError(`Account exchange failed (${status})`, status)
      },
      balance: {
        idempotent: true,
        makeRequest: ({ credential }, signal) => {
          debug.lastBillingToken = credential.token
          debug.lastBillingSessionExchange = debug.sessionExchanges
          return {
            method: 'GET',
            path: workspaceApiUrl('/billing/balance'),
            headers: { Authorization: `Bearer ${credential.token}` },
            signal
          }
        },
        response: { decode: decodeBalance },
        mapError: (status) =>
          new AccountError(`Account balance failed (${status})`, status)
      }
    },
    async transport(request: TransportRequest<unknown>) {
      const response = await fetch(request.path, {
        method: request.method,
        headers: request.headers,
        body:
          request.body === undefined ? undefined : JSON.stringify(request.body)
      })
      return { status: response.status, body: await responseBody(response) }
    }
  }
}

export function createFrontendAccountClients(
  auth: Auth,
  getActiveWorkspace: () => string | null
): {
  session: SessionClient
  billing: BillingClient
  billingCommands: BillingCommands
} {
  const adapter = createFrontendAccountAdapter(auth, getActiveWorkspace)
  const session = createSessionClient(adapter)
  const billing = createBillingClient(session, adapter)
  let operationRecord: AccountLayerOperationRecord | null = null
  let operationContext: Omit<AccountLayerOperationRecord, 'id'> = {
    kind: 'subscribe',
    started_at: Date.now(),
    return_url: null
  }
  const operationStore = {
    namespace,
    async getActiveId() {
      const value = localStorage.getItem(
        paymentStorageKey(auth, getActiveWorkspace)
      )
      if (!value) {
        operationRecord = null
        debug.operationStore.activeId = null
        return null
      }
      operationRecord = value.startsWith('{')
        ? (JSON.parse(value) as AccountLayerOperationRecord)
        : {
            id: value,
            kind: 'subscribe',
            started_at: Date.now(),
            return_url: `${window.location.origin}/payment/success`
          }
      debug.operationStore.activeId = operationRecord.id
      return operationRecord.id
    },
    async setActiveId(id: string) {
      operationRecord = { id, ...operationContext }
      localStorage.setItem(
        paymentStorageKey(auth, getActiveWorkspace),
        JSON.stringify(operationRecord)
      )
      debug.operationStore.activeId = id
    },
    async clearActiveId() {
      localStorage.removeItem(paymentStorageKey(auth, getActiveWorkspace))
      operationRecord = null
      debug.operationStore.activeId = null
    }
  }
  const paymentClient = createBillingApiClient({
    async transport(request) {
      if (request.method === 'GET' && injectedOperationResponse) {
        return { status: 200, body: injectedOperationResponse }
      }
      const state = session.getState()
      if (state.phase !== 'authenticated' && state.phase !== 'refreshing') {
        throw new AccountError('Account session is unavailable')
      }
      if (request.method === 'POST') debug.billingPosts++
      const response = await adapter.transport({
        ...request,
        path: workspaceApiUrl(request.path.replace(/^\/api/, '')),
        headers: {
          ...request.headers,
          Authorization: `Bearer ${state.credential.token}`,
          'Content-Type': 'application/json'
        }
      })
      if (request.path !== '/api/billing/subscribe') return response
      const body = record(response.body)
      return {
        ...response,
        body: {
          ...body,
          action_url:
            typeof body.action_url === 'string'
              ? body.action_url
              : body.payment_method_url
        }
      }
    }
  })
  billingCommands = createBillingCommands({
    client: paymentClient,
    ports: {
      operationStore,
      clock: {
        now: Date.now,
        schedule: (fn, delayMs) => setTimeout(fn, delayMs),
        cancel: (handle) =>
          clearTimeout(handle as ReturnType<typeof setTimeout>)
      },
      async openUrl(url) {
        debug.openUrlCalls++
        debug.lastCheckoutUrl = url
        debug.lastOpenedUrl = url
        return { opened: window.open(url, '_blank') !== null }
      }
    }
  })
  billingCommands.subscribeState((state) => {
    debug.payment = state
  })
  debug.injectOperationResponse = async (response) => {
    injectedOperationResponse = response
    await operationStore.setActiveId('injected-operation')
    await billingCommands?.start()
  }
  debug.refreshCredits = () => billing.refreshCredits()
  debug.runScheduledRefresh = () => scheduledRefresh?.()
  debug.signOut = () => signOut(auth)
  async function readyMutation(
    context: Omit<AccountLayerOperationRecord, 'id'>,
    mutation: () => Promise<void>
  ): Promise<void> {
    await waitUntilAuthenticated(session)
    operationContext = context
    await mutation()
  }
  const seam: AccountLayerPocSeam = {
    getSessionPhase: () => session.getState().phase,
    whenAuthenticated: (timeoutMs) =>
      waitUntilAuthenticated(session, timeoutMs),
    subscribe: (planId = 'pro-monthly') =>
      readyMutation(
        {
          kind: 'subscribe',
          started_at: Date.now(),
          return_url: `${window.location.origin}/payment/success`
        },
        () =>
          billingCommands!.subscribe({
            plan_slug: planId,
            return_url: `${window.location.origin}/payment/success`,
            cancel_url: `${window.location.origin}/payment/failed`
          })
      ),
    topUp: (amount = 500) =>
      readyMutation(
        { kind: 'topup', started_at: Date.now(), return_url: null },
        () =>
          billingCommands!.topUp({
            amount_cents: amount,
            idempotency_key: crypto.randomUUID()
          })
      ),
    cancelSubscription: () =>
      readyMutation(
        { kind: 'cancel', started_at: Date.now(), return_url: null },
        () => billingCommands!.cancelSubscription({})
      ),
    resubscribe: () =>
      readyMutation(
        { kind: 'resubscribe', started_at: Date.now(), return_url: null },
        () => billingCommands!.resubscribe({ plan_slug: 'pro-monthly' })
      ),
    openPaymentPortal: async () => {
      await waitUntilAuthenticated(session)
      await billingCommands!.openPaymentPortal({
        return_url: `${window.location.origin}/payment`
      })
    },
    projectPaymentState: async (state) => {
      debug.payment = state
    },
    getPaymentState: () => debug.payment,
    getOperationStore: () => operationRecord,
    refreshCredits: () => billing.refreshCredits(),
    getCredits: () => billing.getCreditsState(),
    signOut: () => signOut(auth),
    get lastOpenedUrl() {
      return debug.lastOpenedUrl
    }
  }
  Object.assign(debug, seam)
  return { session, billing, billingCommands }
}

function paymentStorageKey(
  auth: Auth,
  getActiveWorkspace: () => string | null
): string {
  return `${namespace}:${auth.currentUser?.uid ?? 'signed-out'}:${getActiveWorkspace() ?? 'no-workspace'}:billing:active-operation`
}

export function getAccountLayerBillingCommands(): BillingCommands {
  if (!billingCommands) throw new AccountError('Billing commands unavailable')
  return billingCommands
}

export function setAccountLayerPocShowBillingModal(show: () => void) {
  debug.showBillingModal = show
}

export function getAccountLayerPocDebug(): Readonly<AccountLayerPocDebug> {
  return debug
}
