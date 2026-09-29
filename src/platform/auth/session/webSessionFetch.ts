import { zErrorResponse } from '@comfyorg/ingest-types/zod'
import { createRequestAuthorizer } from '@comfyorg/account-core/requestAuth'
import type { WebSession } from '@comfyorg/account-core/webSession'

/** The user, session epoch and workspace one request was started for. */
export interface WebSessionRequestScope {
  readonly session: WebSession
  readonly epoch: number
  /** Absent means the personal workspace. */
  readonly workspaceId?: string
}

export interface WebSessionFetchPorts {
  /** A fresh session for the same user and epoch, or undefined to abandon. */
  readonly reread: (
    scope: WebSessionRequestScope
  ) => Promise<WebSessionRequestScope | undefined>
  readonly workspaceDenied: (workspaceId: string) => void
}

const authorize = createRequestAuthorizer({
  getWorkspaceToken: () =>
    Promise.reject(new Error('The cloud app sends no resource requests yet'))
})

async function refusalCode(response: Response): Promise<string | undefined> {
  if (response.status !== 403) return undefined
  const body: unknown = await response
    .clone()
    .json()
    .catch(() => undefined)
  return zErrorResponse.safeParse(body).data?.code
}

/**
 * Sends one ingest request on the session cookie. `csrf_invalid` is the one
 * refusal a fresh token can fix, so it is retried once for the same user and
 * workspace; `workspace_access_denied` drops that workspace and is returned
 * as is, never replayed elsewhere.
 */
export async function fetchOnWebSession(
  url: string,
  init: RequestInit,
  scope: WebSessionRequestScope,
  ports: WebSessionFetchPorts
): Promise<Response> {
  const send = async (current: WebSessionRequestScope) => {
    const { headers, credentials } = await authorize(
      { kind: 'session', session: current.session },
      {
        target: 'ingest',
        method: init.method ?? 'GET',
        workspaceId: current.workspaceId
      }
    )
    const merged = new Headers(init.headers)
    for (const [name, value] of Object.entries(headers)) merged.set(name, value)
    return fetch(url, { ...init, headers: merged, credentials })
  }

  const response = await send(scope)
  const code = await refusalCode(response)
  if (code === 'workspace_access_denied' && scope.workspaceId !== undefined) {
    ports.workspaceDenied(scope.workspaceId)
  }
  if (code !== 'csrf_invalid' || init.body instanceof ReadableStream) {
    return response
  }
  const fresh = await ports.reread(scope)
  return fresh ? send(fresh) : response
}

/** What a signed-in tab's requests need from the web session. */
export interface WebSessionRequests {
  /** Undefined unless this tab is signed in on the session. */
  readonly scope: () => Promise<WebSessionRequestScope | undefined>
  /** The signed-in session's team workspace, for URLs that carry no header. */
  readonly workspaceId: () => string | undefined
  readonly send: (
    url: string,
    init: RequestInit,
    scope: WebSessionRequestScope
  ) => Promise<Response>
}

let provided: WebSessionRequests | undefined

/** Set while the web session is on for this page load; returns its release. */
export function provideWebSessionRequests(
  requests: WebSessionRequests
): () => void {
  provided = requests
  return () => {
    if (provided === requests) provided = undefined
  }
}

export function webSessionRequests(): WebSessionRequests | undefined {
  return provided
}
