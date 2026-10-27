import { useWorkspaceSwitch } from '@/platform/workspace/composables/useWorkspaceSwitch'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

interface WorkspaceCreditsSourceAccess {
  readonly teamWorkspaces: readonly { id: string; name: string }[]
  switchWorkspace(workspaceId: string): Promise<boolean>
}

export function useWorkspaceCreditsSource(): WorkspaceCreditsSourceAccess {
  const workspace = useTeamWorkspaceStore()
  const { switchWorkspace } = useWorkspaceSwitch()
  return {
    get teamWorkspaces() {
      return workspace.sharedWorkspaces
    },
    switchWorkspace
  }
}
