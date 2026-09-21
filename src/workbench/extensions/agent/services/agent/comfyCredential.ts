import { useDialogService } from '@/services/dialogService'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'

const COMFY_TOKEN_HEADER = 'X-Comfy-Token'

/**
 * The signed-in Comfy account's credential for the local agent, which makes
 * its model and CLI calls as this user. The auth rail is chosen first: a
 * Firebase session sends only its fresh ID token (refreshed when close to
 * expiry), and a failed refresh sends nothing rather than a stored API key
 * that may belong to another account. The API key is used only when there is
 * no Firebase session.
 */
async function getComfyCredential(): Promise<string | undefined> {
  const authStore = useAuthStore()
  if (authStore.isAuthenticated) return await authStore.getIdToken()
  return useApiKeyAuthStore().getApiKey() ?? undefined
}

/**
 * Attaches the credential as `X-Comfy-Token`. A credential-bearing request
 * refuses to follow redirects, so the header never reaches another origin.
 */
export async function withComfyCredential(
  init: RequestInit
): Promise<RequestInit> {
  const credential = await getComfyCredential()
  if (credential === undefined) return init
  const headers = new Headers(init.headers)
  headers.set(COMFY_TOKEN_HEADER, credential)
  return { ...init, headers, redirect: 'error' }
}

/**
 * Resolves whether a turn may be sent: signed in, or signed in through the
 * sign-in dialog offered here. The dev server's agent proxy injects its own
 * token, so development sends without asking.
 */
export async function ensureComfyCredential(): Promise<boolean> {
  if ((await getComfyCredential()) !== undefined) return true
  if (import.meta.env.MODE === 'development') return true
  try {
    if (!(await useDialogService().showSignInDialog())) return false
  } catch {
    return false
  }
  return (await getComfyCredential()) !== undefined
}
