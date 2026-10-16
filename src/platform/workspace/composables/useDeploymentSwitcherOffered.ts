import { computed } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { isCloud } from '@/platform/distribution/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

/** Whether the user popover offers the deployment switcher. */
export function useDeploymentSwitcherOffered() {
  const { isApiKeyLogin } = useCurrentUser()
  const workspaceStore = useTeamWorkspaceStore()
  return computed(
    () =>
      isCloud && !isApiKeyLogin.value && workspaceStore.initState === 'ready'
  )
}
