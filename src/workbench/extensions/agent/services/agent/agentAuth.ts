import { useDialogService } from '@/services/dialogService'
import { useAuthStore } from '@/stores/authStore'

/**
 * Every agent request carries the signed-in user's auth header, on every
 * backend. It is the app's user-identity header (`getUserAuthHeader`): the
 * Firebase ID token for a signed-in session, the API key only when there is no
 * session — never a stored key standing in for a session whose token refresh
 * failed, which could belong to another account.
 *
 * In the cloud `api.fetchApi` then applies its own workspace-scoped header on
 * top, exactly as before; the local agent reads this one, the way ingest
 * reads it, and makes its model and CLI calls as the user. Sending it where it
 * is unused is harmless, and one contract replaces a per-backend branch.
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
 * Resolves whether a turn may be sent: signed in, or signed in through the
 * sign-in dialog offered here. The dev server's agent proxy can inject a
 * credential of its own, so development sends without asking.
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
