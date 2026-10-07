import { computed } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { isCloud } from '@/platform/distribution/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

/**
 * Whether the user popover offers the deployment switcher: on Comfy Cloud,
 * once the workspace has loaded (before that the popover shows account
 * actions only), and never in an API-key session, which is bound to one
 * server-resolved workspace and exposes no switching. Anything that picks a
 * deployment outside the switcher follows the same rule.
 */
export function useDeploymentSwitcherOffered() {
  const { isApiKeyLogin } = useCurrentUser()
  const workspaceStore = useTeamWorkspaceStore()
  return computed(
    () =>
      isCloud && !isApiKeyLogin.value && workspaceStore.initState === 'ready'
  )
}
