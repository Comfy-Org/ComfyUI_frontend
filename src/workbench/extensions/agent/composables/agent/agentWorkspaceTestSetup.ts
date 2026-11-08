import { vi } from 'vitest'

import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

type WorkspaceStore = ReturnType<typeof useTeamWorkspaceStore>
type WorkspaceState = WorkspaceStore['workspaces'][number]

export function workspaceState(
  overrides: Pick<WorkspaceState, 'id' | 'name'> & Partial<WorkspaceState>
): WorkspaceState {
  return {
    type: 'team',
    role: 'member',
    created_at: '2026-01-01T00:00:00Z',
    joined_at: '2026-01-01T00:00:00Z',
    members: [],
    pendingInvites: [],
    membersLoaded: true,
    pendingInvitesLoaded: true,
    ...overrides
  }
}

export const personalWorkspace = workspaceState({
  id: 'ws-personal',
  name: 'Personal Workspace',
  type: 'personal',
  role: 'owner'
})

export const studioWorkspace = workspaceState({
  id: 'ws-studio',
  name: 'Studio'
})

export function seedWorkspaces({
  workspaces = [personalWorkspace, studioWorkspace],
  activeWorkspaceId = personalWorkspace.id,
  initState = 'ready'
}: {
  workspaces?: WorkspaceState[]
  activeWorkspaceId?: string | null
  initState?: WorkspaceStore['initState']
} = {}): WorkspaceStore {
  const store: WorkspaceStore & { activeWorkspaceId: string | null } =
    useTeamWorkspaceStore()
  store.activeWorkspaceId = activeWorkspaceId
  store.$patch({ initState, workspaces })
  vi.mocked(store.switchWorkspace).mockResolvedValue()
  return store
}
