import type { ComputedRef } from 'vue'
import { computed } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

export function useBillingIdentity(): ComputedRef<string> {
  const { resolvedUserInfo } = useCurrentUser()
  const teamWorkspaceStore = useTeamWorkspaceStore()
  return computed(
    () =>
      `${resolvedUserInfo.value?.id ?? 'anonymous'}:${teamWorkspaceStore.workspaceId ?? 'none'}`
  )
}
