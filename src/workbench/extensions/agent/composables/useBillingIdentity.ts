import type { ComputedRef } from 'vue'
import { computed } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

/**
 * The key the Agent credit-transition episode is stored under. It has to agree
 * between the panel, which renders and dismisses the notice, and the dock
 * mount, which observes the scoped balance — a drift between the two silently
 * hides the notice, because the episode is then armed under one key and read
 * under another. Keep this the only place the shape is written.
 */
export function formatBillingIdentity(
  userId: string | null | undefined,
  workspaceId: string | null | undefined
): string {
  return `${userId ?? 'anonymous'}:${workspaceId ?? 'none'}`
}

export function useBillingIdentity(): ComputedRef<string> {
  const { resolvedUserInfo } = useCurrentUser()
  const teamWorkspaceStore = useTeamWorkspaceStore()
  return computed(() =>
    formatBillingIdentity(
      resolvedUserInfo.value?.id,
      teamWorkspaceStore.workspaceId
    )
  )
}
