import { useWorkspaceSwitch } from '@/platform/workspace/composables/useWorkspaceSwitch'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

type PersonalWorkspaceSwitch = 'active' | 'reloading' | 'failed'

interface WorkspaceCreditsSourceAccess {
  readonly teamWorkspaces: readonly { id: string; name: string }[]
  switchWorkspace(workspaceId: string): Promise<boolean>
  switchToPersonalWorkspace(): Promise<PersonalWorkspaceSwitch>
}

export function useWorkspaceCreditsSource(): WorkspaceCreditsSourceAccess {
  const workspace = useTeamWorkspaceStore()
  const { switchWorkspace } = useWorkspaceSwitch()
  return {
    get teamWorkspaces() {
      return workspace.sharedWorkspaces
    },
    switchWorkspace,
    switchToPersonalWorkspace: async () => {
      const initialized = await workspace.initialize().then(
        () => true,
        () => false
      )
      if (!initialized) return 'failed'
      if (!workspace.personalWorkspace) return 'active'
      if (!(await switchWorkspace(workspace.personalWorkspace.id)))
        return 'failed'
      return workspace.isSwitching ? 'reloading' : 'active'
    }
  }
}
