import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

const REFUSAL_KEYS = {
  organization_managed: 'workspaceSwitcher.organizationManagesWorkspaces',
  owned_workspace_limit: 'workspaceSwitcher.maxWorkspacesReached',
  unknown: 'workspaceSwitcher.cannotCreateWorkspace'
} as const

/** The notice shown in place of creating a workspace, or null when creation is allowed. */
export function useCreateWorkspaceRefusal() {
  const { t } = useI18n()
  const { createWorkspaceRefusal, maxOwnedWorkspaces } = storeToRefs(
    useTeamWorkspaceStore()
  )

  return computed(() =>
    createWorkspaceRefusal.value
      ? t(REFUSAL_KEYS[createWorkspaceRefusal.value], {
          max: maxOwnedWorkspaces.value
        })
      : null
  )
}
