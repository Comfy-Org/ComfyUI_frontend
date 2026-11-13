import { ref, watch } from 'vue'
import type { AccountCredential } from '@comfyorg/account-core/session'
import type {
  WebSessionRequestScope,
  WebSessionRequests
} from '@comfyorg/api-client/webSessionFetch'
import { bindAnalyticsConsentRuntime } from '@comfyorg/api-client/analyticsConsentRuntime'
import type { ConsentReceiptConfiguration } from '@comfyorg/api-client/analyticsConsentReceiptBridge'
import {
  subscribeWebSessionRequests,
  webSessionRequests
} from '@comfyorg/api-client/webSessionFetch'
import { useAuthStore } from '@/stores/authStore'
import { useCloudWebSessionStore } from '@/platform/auth/session/cloudWebSessionStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { api } from '@/scripts/api'

export interface HomepageConsentSource {
  configuration: Readonly<ConsentReceiptConfiguration>
  subscribe: (
    listener: (explicitPostHogConsent: boolean | undefined) => void
  ) => () => void
  setEligible: (eligible: boolean) => void
}

function matchesSessionScope(
  scope: WebSessionRequestScope | undefined,
  actor: string,
  workspace: string
): scope is WebSessionRequestScope {
  return scope?.session.user.id === actor && scope.workspaceId === workspace
}

function matchesCredential(
  credential: AccountCredential,
  actor: string,
  workspace: string
): boolean {
  return credential.uid === actor && credential.workspace.id === workspace
}

async function readMatchingCredential(
  requests: WebSessionRequests,
  actor: string,
  workspace: string,
  isCurrent: () => boolean
): Promise<AccountCredential | undefined> {
  const scope = await requests.scope()
  if (!matchesSessionScope(scope, actor, workspace)) return undefined
  const result = await requests.workspaceToken(scope)
  const current = await requests.scope()
  if (
    !isCurrent() ||
    result.status !== 'ok' ||
    !matchesSessionScope(current, actor, workspace) ||
    current.epoch !== scope.epoch
  )
    return undefined
  return matchesCredential(result.credential, actor, workspace)
    ? result.credential
    : undefined
}

/** Installs the Cloud host only for an explicitly supplied reviewed consent source. */
export function installCloudHomepageConsentHost(
  source?: HomepageConsentSource
): () => void {
  if (!source?.configuration.enabled) return () => {}
  const auth = useAuthStore()
  const session = useCloudWebSessionStore()
  const workspaces = useTeamWorkspaceStore()
  const runtime = bindAnalyticsConsentRuntime(source.configuration, {
    apiBaseUrl: api.apiURL(''),
    onPostHogConsent: source.subscribe,
    setEligible: source.setEligible,
    onSession: (listener) => {
      let revision = 0
      let disposed = false
      const providerRevision = ref(0)
      const stopProvider = subscribeWebSessionRequests(() => {
        providerRevision.value++
      })
      const stop = watch(
        () =>
          [
            auth.userId,
            workspaces.activeWorkspaceId,
            session.state,
            auth.tokenRefreshTrigger,
            providerRevision.value
          ] as const,
        async ([actor, workspace]) => {
          const generation = ++revision
          listener(undefined)
          if (!actor || !workspace) return
          const requests = webSessionRequests()
          if (!requests) return
          const isCurrent = () =>
            !disposed &&
            generation === revision &&
            webSessionRequests() === requests &&
            auth.userId === actor &&
            workspaces.activeWorkspaceId === workspace
          try {
            const credential = await readMatchingCredential(
              requests,
              actor,
              workspace,
              isCurrent
            )
            if (credential) listener(credential)
          } catch {
            if (!disposed && generation === revision) listener(undefined)
          }
        },
        { immediate: true, flush: 'sync' }
      )
      return () => {
        disposed = true
        ++revision
        stop()
        stopProvider()
      }
    }
  })
  return () => runtime.dispose()
}
