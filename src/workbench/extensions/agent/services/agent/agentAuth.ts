import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { authCredentialOf } from '@/platform/auth/authCredential'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'
import type { AuthCredential } from '@/types/authTypes'

interface AgentRequestInit extends RequestInit {
  onAuthCredential?: (credential: AuthCredential) => void
}

export async function withAgentAuth<T extends AgentRequestInit>(
  init: T
): Promise<T & RequestInit> {
  const header = await useAuthStore().getUserAuthHeader()
  if (!header) return init
  const headers = new Headers(init.headers)
  for (const [name, value] of Object.entries(header)) headers.set(name, value)
  const attached = authCredentialOf(header)
  return {
    ...init,
    headers,
    redirect: 'error',
    onAuthCredential: (credential) =>
      init.onAuthCredential?.(credential === 'none' ? attached : credential)
  }
}

export async function agentSocketToken(): Promise<string | undefined> {
  const header = await useAuthStore().getAuthHeader()
  if (!header) return undefined
  return 'X-API-KEY' in header
    ? header['X-API-KEY']
    : header.Authorization.slice('Bearer '.length)
}

export function hasAgentCredential(): boolean {
  return (
    useAuthStore().isAuthenticated ||
    useApiKeyAuthStore().getAuthHeader() !== null
  )
}

function devProxySuppliesCredential(): boolean {
  return (
    import.meta.env.MODE === 'development' &&
    import.meta.env.VITE_AGENT_STANDALONE === 'true'
  )
}

export async function ensureSignedIn(): Promise<boolean> {
  const authStore = useAuthStore()
  if (await authStore.getUserAuthHeader()) return true
  if (devProxySuppliesCredential()) return true
  try {
    if (!(await useAuthDialogs().showSignInDialog())) return false
  } catch {
    return false
  }
  return (await authStore.getUserAuthHeader()) !== null
}
