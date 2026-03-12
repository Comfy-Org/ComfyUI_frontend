import { storeToRefs } from 'pinia'

import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

export function useWorkspaceSwitch() {
  const workspaceStore = useTeamWorkspaceStore()
  const { activeWorkspace } = storeToRefs(workspaceStore)

  async function switchWorkspace(workspaceId: string): Promise<boolean> {
    if (activeWorkspace.value?.id === workspaceId) {
      return true
    }

    try {
      await workspaceStore.switchWorkspace(workspaceId)
      return true
    } catch {
      return false
    }
  }

  return {
    switchWorkspace
  }
}
