import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

const RESPONDED_PREFIX = 'Comfy.AgentConsent.IntroductionResponded'

export const useAgentConsentIntroductionStore = defineStore(
  'agentConsentIntroduction',
  () => {
    const { isLoggedIn, resolvedUserInfo } = useCurrentUser()
    const workspaceStore = useTeamWorkspaceStore()
    const isContinuingSignIn = ref(false)

    const scope = computed(() => {
      if (!isLoggedIn.value) return 'signed-out'
      const userId = resolvedUserInfo.value?.id
      const workspaceId = workspaceStore.activeWorkspaceId
      return userId && workspaceId ? `${userId}.${workspaceId}` : null
    })

    function hasResponded(responseScope: string): boolean {
      try {
        return (
          localStorage.getItem(`${RESPONDED_PREFIX}.${responseScope}`) ===
          'true'
        )
      } catch {
        return false
      }
    }

    function markResponded(): boolean {
      if (!scope.value) return false
      try {
        localStorage.setItem(`${RESPONDED_PREFIX}.${scope.value}`, 'true')
        return true
      } catch {
        return false
      }
    }

    return { scope, hasResponded, markResponded, isContinuingSignIn }
  }
)
