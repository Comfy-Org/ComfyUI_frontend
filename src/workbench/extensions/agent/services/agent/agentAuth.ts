import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { authCredentialOf } from '@/platform/auth/authCredential'
import { isCloud } from '@/platform/distribution/types'
import { api } from '@/scripts/api'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'
import type { AuthHeader } from '@/types/authTypes'

type AgentRequestInit = NonNullable<Parameters<typeof api.fetchApi>[1]>

function credentialValue(header: AuthHeader): string {
  return 'X-API-KEY' in header
    ? header['X-API-KEY']
    : header.Authorization.slice('Bearer '.length)
}

export async function withAgentAuth(
  init: AgentRequestInit
): Promise<AgentRequestInit> {
  if (isCloud) return init
  const header = await useAuthStore().getUserAuthHeader()
  if (!header) return init
  const headers = new Headers(init.headers)
  for (const [name, value] of Object.entries(header)) headers.set(name, value)
  const attached = authCredentialOf(header)
  return {
    ...init,
    headers,
    redirect: 'error',
    onAuthScheme: () => init.onAuthScheme?.('cloud-auth-header'),
    onAuthCredential: () => init.onAuthCredential?.(attached)
  }
}

export async function agentSocketAuthParams(): Promise<URLSearchParams | null> {
  if (isCloud) return api.socketAuthParams()
  const params = new URLSearchParams()
  const header = await useAuthStore().getUserAuthHeader()
  if (header) params.set('token', credentialValue(header))
  return params
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
    import.meta.env.VITE_DEV_AGENT_PROXY_CREDENTIAL === 'true'
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
  return hasAgentCredential() || (await authStore.getUserAuthHeader()) !== null
}
