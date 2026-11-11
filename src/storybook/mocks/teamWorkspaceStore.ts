import { computed, reactive, ref } from 'vue'

import type {
  WorkspacePendingInvite,
  WorkspaceMember,
  useTeamWorkspaceStore as realUseTeamWorkspaceStore
} from '@/platform/workspace/stores/teamWorkspaceStore'

type RealTeamWorkspaceStore = ReturnType<typeof realUseTeamWorkspaceStore>

type TeamWorkspaceMock = Pick<
  RealTeamWorkspaceStore['workspaces'][number],
  'id' | 'name' | 'type' | 'role'
>

/** The workspace list a story wants the stub to report. */
export interface TeamWorkspaceMockState {
  initState: RealTeamWorkspaceStore['initState']
  workspaces: TeamWorkspaceMock[]
  activeWorkspaceId: string | null
}

const MAX_OWNED_WORKSPACES = 10

const defaultState: TeamWorkspaceMockState = {
  initState: 'uninitialized',
  workspaces: [],
  activeWorkspaceId: null
}

const state = ref<TeamWorkspaceMockState>({ ...defaultState })

/** Drives the stub from a story's `beforeEach`. */
export function setTeamWorkspaceMock(next: Partial<TeamWorkspaceMockState>) {
  state.value = { ...defaultState, ...next }
}

/**
 * Storybook mock for `useTeamWorkspaceStore`.
 *
 * The real store pulls in workspace auth/network state that is unavailable in
 * Storybook. This stub resolves invites locally so the post-upgrade invite
 * block can be exercised without a backend. It reports no workspaces until a
 * story calls `setTeamWorkspaceMock`, and switches between them locally.
 */
export function useTeamWorkspaceStore() {
  return reactive({
    members: [] as WorkspaceMember[],
    pendingInvites: [] as WorkspacePendingInvite[],
    createInvite: async (email: string): Promise<WorkspacePendingInvite> => ({
      id: `inv-${email}`,
      email,
      inviteDate: new Date(0),
      expiryDate: new Date(0)
    }),
    initState: computed(() => state.value.initState),
    workspaces: computed(() => state.value.workspaces),
    activeWorkspace: computed(
      () =>
        state.value.workspaces.find(
          (workspace) => workspace.id === state.value.activeWorkspaceId
        ) ?? null
    ),
    canCreateWorkspace: computed(
      () =>
        state.value.workspaces.filter((workspace) => workspace.role === 'owner')
          .length < MAX_OWNED_WORKSPACES
    ),
    switchWorkspace: async (workspaceId: string): Promise<void> => {
      state.value = { ...state.value, activeWorkspaceId: workspaceId }
    }
  })
}
