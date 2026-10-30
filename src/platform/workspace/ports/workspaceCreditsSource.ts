import { useWorkspaceSwitch } from '@/platform/workspace/composables/useWorkspaceSwitch'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

/** `reloading`: the switch is reloading the page into the personal workspace. */
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
      await workspace.initialize().catch(() => undefined)
      if (!workspace.personalWorkspace) return 'active'
      if (!(await switchWorkspace(workspace.personalWorkspace.id)))
        return 'failed'
      return workspace.isSwitching ? 'reloading' : 'active'
    }
  }
}
