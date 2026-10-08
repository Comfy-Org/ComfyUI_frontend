import { computed, watch } from 'vue'

import { isCloud } from '@/platform/distribution/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useAuthStore } from '@/stores/authStore'

export function useNodeAccountScope() {
  const auth = isCloud ? useAuthStore() : undefined
  const apiAuth = isCloud ? useApiKeyAuthStore() : undefined
  const workspace = isCloud ? useTeamWorkspaceStore() : undefined
  const scope = computed(() => {
    if (!isCloud) return 'local'
    const user = apiAuth?.currentUser?.id ?? auth?.userId
    return user
      ? JSON.stringify([
          user,
          workspace?.activeWorkspaceId,
          workspace?.workspaceTransitionGeneration
        ])
      : null
  })
  let generation = 0
  watch(
    scope,
    () => {
      generation += 1
    },
    { flush: 'sync' }
  )
  const capture = () => ({ scope: scope.value, generation })
  const current = (request: ReturnType<typeof capture>) =>
    request.scope !== null &&
    request.scope === scope.value &&
    request.generation === generation
  return { scope, capture, current }
}
