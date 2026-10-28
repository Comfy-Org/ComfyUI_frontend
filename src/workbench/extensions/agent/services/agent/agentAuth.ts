import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { authCredentialOf } from '@/platform/auth/authCredential'
import { isDesktopHostSignedIn } from '@/platform/auth/desktopHost/desktopHostSession'
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

function isApiKeySession(): boolean {
  const authStore = useAuthStore()
  return (
    !isDesktopHostSignedIn() &&
    !authStore.currentUser &&
    !authStore.sessionOnlyUser &&
    useApiKeyAuthStore().isAuthenticated
  )
}

async function agentAuthHeader(): Promise<AuthHeader | null> {
  if (isApiKeySession()) return useApiKeyAuthStore().getAuthHeader()
  const authStore = useAuthStore()
  if (!authStore.isAuthenticated) return null
  return {
    Authorization: `Bearer ${await authStore.getWorkspaceAuthTokenOrThrow()}`
  }
}

/**
 * Credential for the agent's Global Settings rows, which today means consent.
 *
 * The row (`Comfy.AgentPanel.ConsentAccepted`) is keyed by BOTH `workspace_id` and
 * `user_id`, and cloud's grant check reads it with `WorkspaceIDEQ` plus `UserIDEQ`, so
 * the credential has to pin the workspace as well as identify the user. Off-cloud this
 * is the same workspace bearer every other agent request carries: a personal session
 * header would leave the workspace to resolve on its own and write the row under the
 * wrong one. It lives here because this file owns the one distribution branch.
 */
export async function agentSettingsAuthHeader(): Promise<AuthHeader | null> {
  if (isCloud) return useAuthStore().getWorkspaceAuthHeader()
  return agentAuthHeader()
}

export async function withAgentAuth(
  init: AgentRequestInit
): Promise<AgentRequestInit> {
  if (isCloud) return init
  const header = await agentAuthHeader()
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
  const header = await agentAuthHeader()
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
