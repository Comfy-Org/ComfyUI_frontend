import { AccountError, MalformedResponseError } from '@comfyorg/account/core'
import type {
  AccountHostAdapter,
  BillingBalanceResponse,
  IdentitySnapshot,
  StorageKey,
  TransportRequest,
  WorkspaceCredential
} from '@comfyorg/account/core'

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
  return { token: input.token, workspaceId: workspace.id, expiresAt }
}

function decodeBalance(value: unknown): BillingBalanceResponse {
  const input = record(value)
  if (typeof input.effective_balance_micros !== 'number') {
    throw new MalformedResponseError()
  }
  return { balance: input.effective_balance_micros }
}

function storageName(key: StorageKey): string {
  return `${key.namespace}:${key.userId}:${key.workspaceId}`
}

export function createWebsiteAccountHostAdapter(
  apiBaseUrl: string,
  identity: () => IdentitySnapshot | null,
  workspaceId: () => string | null
): AccountHostAdapter {
  return {
    namespace: 'comfy-website-account-layer-poc',
    scheduler: {
      now: Date.now,
      schedule: (fn, delayMs) => setTimeout(fn, delayMs),
      cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)
    },
    async acquireIdentity() {
      return identity()
    },
    getActiveWorkspace: workspaceId,
    storage: {
      async read(key) {
        const value = localStorage.getItem(storageName(key))
        return value === null ? null : JSON.parse(value)
      },
      async write(key, value) {
        localStorage.setItem(storageName(key), JSON.stringify(value))
      },
      async clear(key) {
        localStorage.removeItem(storageName(key))
      }
    },
    operations: {
      exchange: {
        idempotent: true,
        makeRequest: ({ identity, workspaceId }, signal) => ({
          method: 'POST',
          path: '/api/auth/token',
          headers: { 'Content-Type': 'application/json' },
          body: {
            identityToken: identity.token,
            workspaceId
          },
          signal
        }),
        response: { decode: decodeCredential },
        mapError: (status, body) =>
          new AccountError('Account exchange failed', status, body)
      },
      balance: {
        idempotent: true,
        makeRequest: ({ credential }, signal) => ({
          method: 'GET',
          path: '/api/billing/balance',
          headers: { Authorization: `Bearer ${credential.token}` },
          signal
        }),
        response: { decode: decodeBalance },
        mapError: (status, body) =>
          new AccountError('Account balance failed', status, body)
      }
    },
    async transport(request: TransportRequest<unknown>) {
      const response = await fetch(`${apiBaseUrl}${request.path}`, {
        method: request.method,
        headers: request.headers,
        body:
          request.body === undefined ? undefined : JSON.stringify(request.body)
      })
      return {
        status: response.status,
        body: await response.json().catch(() => null)
      }
    }
  }
}
