import { useDialogService } from '@/services/dialogService'
import { useAuthStore } from '@/stores/authStore'

/**
 * How agent traffic carries the signed-in user's credential, on every backend.
 *
 * This is the same hand-off partner (API) nodes already make on a local build:
 * `queuePrompt` puts the signed-in credential in the request so the local
 * ComfyUI can call Comfy's API as the user (`auth_token_comfy_org` /
 * `api_key_comfy_org`). The local agent makes its model calls as the user in
 * the same way; its requests are REST and a WebSocket rather than a queued
 * prompt, so the credential rides the standard header (`Authorization` or
 * `X-API-KEY`, read the way ingest reads them) and, for the socket, `?token=`.
 * In the cloud, `api.fetchApi` still applies its workspace header on top, so
 * nothing changes there.
 */

/**
 * The user's auth header on every agent REST request: the Firebase ID token
 * for a signed-in session, the API key only when there is no session — never a
 * stored key standing in for a session whose token refresh failed, which could
 * belong to another account.
 *
 * A request that carries the header refuses to follow redirects, so it never
 * reaches another origin (fetch strips Authorization on a cross-origin
 * redirect, but not an API-key header).
 */
export async function withAgentAuth(init: RequestInit): Promise<RequestInit> {
  const header = await useAuthStore().getUserAuthHeader()
  if (!header) return init
  const headers = new Headers(init.headers)
  for (const [name, value] of Object.entries(header)) headers.set(name, value)
  return { ...init, headers, redirect: 'error' }
}

/**
 * The credential for the agent socket's `?token=` (a browser cannot set
 * headers on a WebSocket). It is the one `api.fetchApi` sends, so the socket
 * lands in the same workspace as every other request: workspace-scoped in the
 * cloud, the user's token (or API key) locally.
 */
export async function agentSocketToken(): Promise<string | undefined> {
  const header = await useAuthStore().getAuthHeader()
  if (!header) return undefined
  return 'X-API-KEY' in header
    ? header['X-API-KEY']
    : header.Authorization.slice('Bearer '.length)
}

/**
 * Resolves whether a turn may be sent: signed in, or signed in through the
 * sign-in dialog offered here — the same dialog partner nodes use. The dev
 * server's agent proxy can inject a credential of its own, so development
 * sends without asking.
 */
export async function ensureSignedIn(): Promise<boolean> {
  const authStore = useAuthStore()
  if (await authStore.getUserAuthHeader()) return true
  if (import.meta.env.MODE === 'development') return true
  try {
    if (!(await useDialogService().showSignInDialog())) return false
  } catch {
    return false
  }
  return (await authStore.getUserAuthHeader()) !== null
}
