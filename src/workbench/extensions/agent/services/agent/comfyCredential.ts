import { useDialogService } from '@/services/dialogService'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'

const COMFY_TOKEN_HEADER = 'X-Comfy-Token'

/**
 * The signed-in Comfy account's credential for the local agent, which makes
 * its model and CLI calls as this user: a fresh Firebase ID token (refreshed
 * when close to expiry), else the stored Comfy API key.
 */
async function getComfyCredential(): Promise<string | undefined> {
  return (
    (await useAuthStore().getIdToken()) ??
    useApiKeyAuthStore().getApiKey() ??
    undefined
  )
}

export async function withComfyCredential(
  init: RequestInit
): Promise<RequestInit> {
  const credential = await getComfyCredential()
  if (credential === undefined) return init
  const headers = new Headers(init.headers)
  headers.set(COMFY_TOKEN_HEADER, credential)
  return { ...init, headers }
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
