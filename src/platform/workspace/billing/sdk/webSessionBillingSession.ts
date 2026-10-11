import type {
  BillingScope,
  BillingScopeSource,
  BillingSession
} from '@comfyorg/account-core/billing'
import type {
  SessionErrorCode,
  SessionRequestOptions,
  SessionResult,
  SessionSnapshot
} from '@comfyorg/account-core/session'
import type { SessionTokenResult } from '@comfyorg/account-core/sessionTokenMint'
import type { WebSessionErrorCode } from '@comfyorg/account-core/webSession'
import { watch } from 'vue'

import { useCloudWebSessionStore } from '@/platform/auth/session/cloudWebSessionStore'
import type {
  WebSessionRequestScope,
  WebSessionRequests
} from '@/platform/auth/session/webSessionFetch'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'

export type WebSessionBillingSession = BillingSession & BillingScopeSource

const SESSION_CODE: Readonly<
  Record<Exclude<WebSessionErrorCode, 'IDENTITY_CHANGED'>, SessionErrorCode>
> = {
  NO_SESSION: 'NOT_AUTHENTICATED',
  SESSION_EXPIRED: 'NOT_AUTHENTICATED',
  SESSION_REVOKED: 'NOT_AUTHENTICATED',
  WORKSPACE_ACCESS_DENIED: 'ACCESS_DENIED',
  CSRF_STALE: 'TOKEN_EXCHANGE_FAILED',
  SESSION_REQUEST_REFUSED: 'TOKEN_EXCHANGE_FAILED',
  SSO_REQUIRED: 'SSO_REQUIRED',
  SESSION_UNAVAILABLE: 'TOKEN_EXCHANGE_FAILED'
}

const SIGNED_OUT: SessionSnapshot = {
  phase: 'signed-out',
  user: null,
  session: undefined
}

function sessionResult(result: SessionTokenResult): SessionResult | undefined {
  if (result.status === 'ok')
    return { status: 'ok', session: result.credential }
  if (result.code === 'IDENTITY_CHANGED') return undefined
  return {
    status: 'error',
    code: SESSION_CODE[result.code],
    ...(result.httpStatus === undefined
      ? {}
      : { httpStatus: result.httpStatus })
  }
}

/**
 * The billing SDK's session on a tab signed in on the web session: tokens
 * come from the session mint, and the scope from the session user and the
 * selected workspace, which are known before anything is minted.
 */
export function createWebSessionBillingSession(
  requests: WebSessionRequests
): WebSessionBillingSession {
  const webSession = useCloudWebSessionStore()
  const workspaceAuth = useWorkspaceAuthStore()

  function getScope(): BillingScope | undefined {
    const user = webSession.signedInUser
    const workspace = workspaceAuth.currentWorkspace
    if (!user || !workspace) return undefined
    return { userId: user.id, workspaceId: workspace.id, role: workspace.role }
  }

  function getSnapshot(): SessionSnapshot {
    const scope = getScope()
    if (!scope) return SIGNED_OUT
    return {
      phase: 'minting',
      user: {
        uid: scope.userId,
        getIdToken: () =>
          Promise.reject(new Error('A web session has no Firebase ID token'))
      },
      session: undefined
    }
  }

  const mintWith =
    (mint: (scope: WebSessionRequestScope) => Promise<SessionTokenResult>) =>
    async (
      _user: unknown,
      options?: SessionRequestOptions
    ): Promise<SessionResult | undefined> => {
      const scope = await requests.scope()
      if (!scope) return undefined
      return sessionResult(
        await mint({ ...scope, workspaceId: options?.workspaceId })
      )
    }

  return {
    getScope,
    getSnapshot,
    subscribe: (listener) =>
      watch(getScope, () => listener(getSnapshot()), {
        flush: 'sync'
      }),
    ensureFresh: mintWith(requests.workspaceToken),
    remint: mintWith(requests.remintWorkspaceToken)
  }
}
