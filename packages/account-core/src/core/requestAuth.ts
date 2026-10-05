/**
 * Decides the credential headers for one request, and nothing else: callers
 * send, retry, and track scope. A cookie session authorizes ingest itself;
 * every other service takes a Bearer workspace token. Firebase and API-key
 * principals keep the single header they send today, whatever the target.
 */
import packageManifest from '../../package.json' with { type: 'json' }

import type { WebSession } from './sessionContracts.js'

export type RequestTarget = 'ingest' | 'resource'

export type RequestPrincipal =
  | { readonly kind: 'session'; readonly session: WebSession }
  | { readonly kind: 'firebase'; readonly getIdToken: () => Promise<string> }
  | { readonly kind: 'apiKey'; readonly apiKey: string }

export interface RequestAuthInput {
  readonly target: RequestTarget
  readonly method: string
  /** Absent means the personal workspace. */
  readonly workspaceId?: string
}

export interface RequestAuthorization {
  readonly headers: Readonly<Record<string, string>>
  /** Set only for a cookie request, which must carry the session cookie. */
  readonly credentials?: 'include'
}

export type RequestAuthorizer = (
  principal: RequestPrincipal,
  input: RequestAuthInput
) => Promise<RequestAuthorization>

export interface RequestAuthOptions {
  /** A workspace token for a session principal; minting is the caller's. */
  readonly getWorkspaceToken: (
    workspaceId: string | undefined
  ) => Promise<string>
}

export const COMFY_CLIENT = `${packageManifest.name}/${packageManifest.version}`

const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS'])

function sessionHeaders(
  session: WebSession,
  { method, workspaceId }: RequestAuthInput
): Record<string, string> {
  return {
    'X-Comfy-Client': COMFY_CLIENT,
    ...(workspaceId === undefined
      ? {}
      : { 'X-Comfy-Workspace-ID': workspaceId }),
    ...(SAFE_METHODS.has(method.toUpperCase())
      ? {}
      : { 'X-CSRF-Token': session.csrfToken })
  }
}

export function createRequestAuthorizer({
  getWorkspaceToken
}: RequestAuthOptions): RequestAuthorizer {
  return async function authorize(
    principal,
    input
  ): Promise<RequestAuthorization> {
    switch (principal.kind) {
      case 'apiKey':
        return { headers: { 'X-API-KEY': principal.apiKey } }
      case 'firebase':
        return {
          headers: { Authorization: `Bearer ${await principal.getIdToken()}` }
        }
      case 'session':
        if (input.target === 'resource') {
          const token = await getWorkspaceToken(input.workspaceId)
          return { headers: { Authorization: `Bearer ${token}` } }
        }
        return {
          headers: sessionHeaders(principal.session, input),
          credentials: 'include'
        }
    }
  }
}
