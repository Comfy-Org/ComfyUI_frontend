import { useStorage } from '@vueuse/core'
import type { UseStorageOptions } from '@vueuse/core'
import { computed } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { isCloud } from '@/platform/distribution/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import { accountScope } from '../base/accountScope'
import { agentStorage } from '../base/agentStorage'

export function useAccountScope() {
  const { resolvedUserInfo } = useCurrentUser()
  const workspace = isCloud ? useTeamWorkspaceStore() : null
  return computed(() =>
    accountScope(
      resolvedUserInfo.value?.id,
      workspace ? workspace.activeWorkspaceId : 'personal'
    )
  )
}

export function useAccountStorage<T>(
  key: (scope: string) => string,
  initial: T,
  options: UseStorageOptions<T> = {},
  scope = useAccountScope()
) {
  return useStorage(
    () => (scope.value === null ? '' : key(scope.value)),
    initial,
    agentStorage,
    {
      ...options,
      flush: 'sync',
      writeDefaults: false,
      listenToStorageChanges: false
    }
  )
}
