import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { safeLocalStorage } from '@/base/storage/safeStorage'
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
      return (
        safeLocalStorage.getItem(`${RESPONDED_PREFIX}.${responseScope}`) ===
        'true'
      )
    }

    function markResponded(): boolean {
      if (!scope.value) return false
      return (
        safeLocalStorage.setItem(
          `${RESPONDED_PREFIX}.${scope.value}`,
          'true'
        ) === 'ok'
      )
    }

    function canRecordResponse(): boolean {
      if (!scope.value) return false
      const probeKey = `${RESPONDED_PREFIX}.${scope.value}.probe`
      if (safeLocalStorage.setItem(probeKey, 'true') !== 'ok') return false
      safeLocalStorage.removeItem(probeKey)
      return true
    }

    return {
      scope,
      hasResponded,
      markResponded,
      canRecordResponse,
      isContinuingSignIn
    }
  }
)
