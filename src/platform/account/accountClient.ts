import {
  AccountError,
  MalformedResponseError,
  createBillingClient,
  createSessionClient
} from '@comfyorg/account/core'
import type {
  AccountHostAdapter,
  BillingBalanceResponse,
  BillingClient,
  SessionClient,
  StorageKey,
  TransportRequest,
  WorkspaceCredential
} from '@comfyorg/account/core'
import { signOut } from 'firebase/auth'
import type { Auth } from 'firebase/auth'

import { workspaceApiUrl } from '@/platform/workspace/api/workspaceApiUrl'

const namespace = 'comfyui-frontend-account-layer-poc'

export interface AccountLayerPocDebug {
  billingRequests: number
  sessionExchanges: number
  lastBillingToken: string | null
  lastSessionToken: string | null
  lastBillingSessionExchange: number | null
  credentialLifetimeMs: number | null
  refreshScheduleDelayMs: number | null
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
  refreshCredits: async () => undefined,
  runScheduledRefresh: () => undefined,
  signOut: async () => undefined
}

let scheduledRefresh: (() => void) | undefined

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
): { session: SessionClient; billing: BillingClient } {
  const adapter = createFrontendAccountAdapter(auth, getActiveWorkspace)
  const session = createSessionClient(adapter)
  const billing = createBillingClient(session, adapter)
  debug.refreshCredits = () => billing.refreshCredits()
  debug.runScheduledRefresh = () => scheduledRefresh?.()
  debug.signOut = () => signOut(auth)
  return { session, billing }
}

export function getAccountLayerPocDebug(): Readonly<AccountLayerPocDebug> {
  return debug
}
