import { ref, watch } from 'vue'
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
          try {
            const scope = await requests.scope()
            if (
              !scope ||
              scope.session.user.id !== actor ||
              scope.workspaceId !== workspace
            )
              return
            const result = await requests.workspaceToken(scope)
            const current = await requests.scope()
            if (
              disposed ||
              generation !== revision ||
              webSessionRequests() !== requests ||
              result.status !== 'ok' ||
              !current ||
              current.epoch !== scope.epoch ||
              current.workspaceId !== scope.workspaceId ||
              current.session.user.id !== actor ||
              auth.userId !== actor ||
              workspaces.activeWorkspaceId !== workspace ||
              result.credential.uid !== actor ||
              result.credential.workspace.id !== workspace
            )
              return
            listener(result.credential)
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
