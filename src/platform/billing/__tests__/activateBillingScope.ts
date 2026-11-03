import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useAuthStore } from '@/stores/authStore'
import { stubFirebaseAuthHarness } from '@/utils/__tests__/stubAccountIdentityPort'

export function activateBillingScope(actorId: string, workspaceId: string) {
  stubFirebaseAuthHarness()
  Object.assign(useAuthStore(), { userId: actorId })
  Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: workspaceId })
}
