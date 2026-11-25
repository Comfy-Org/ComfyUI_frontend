import { describe, expect, it, vi } from 'vitest'

import { useWorkspaceSwitch } from '@/platform/workspace/composables/useWorkspaceSwitch'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import { useWorkspaceCreditsSource } from './workspaceCreditsSource'

vi.mock(import('@/platform/workspace/composables/useWorkspaceSwitch'))

type WorkspaceState = ReturnType<
  typeof useTeamWorkspaceStore
>['workspaces'][number]

const personalWorkspace: WorkspaceState = {
  id: 'ws-personal',
  name: 'Personal',
  type: 'personal',
  role: 'owner',
  created_at: '2025-01-01',
  joined_at: '2025-01-01',
  members: [],
  pendingInvites: [],
  membersLoaded: true,
  pendingInvitesLoaded: true
}

function mockWorkspace({
  workspaces,
  isSwitching = false,
  switchSucceeds = true
}: {
  workspaces: WorkspaceState[]
  isSwitching?: boolean
  switchSucceeds?: boolean
}) {
  const store = useTeamWorkspaceStore()
  store.isSwitching = isSwitching
  vi.spyOn(store, 'initialize').mockImplementation(async () => {
    store.workspaces = workspaces
  })
  const switchWorkspace = vi.fn().mockResolvedValue(switchSucceeds)
  vi.mocked(useWorkspaceSwitch).mockReturnValue({ switchWorkspace })
  return { switchWorkspace }
}

describe('useWorkspaceCreditsSource', () => {
  it.for([
    {
      name: 'is active once the switch lands in place',
      isSwitching: false,
      switchSucceeds: true,
      expected: 'active'
    },
    {
      name: 'is reloading while the switch reloads the page',
      isSwitching: true,
      switchSucceeds: true,
      expected: 'reloading'
    },
    {
      name: 'fails when the switch fails',
      isSwitching: false,
      switchSucceeds: false,
      expected: 'failed'
    }
  ])(
    'switching to the personal workspace $name',
    async ({ isSwitching, switchSucceeds, expected }) => {
      const { switchWorkspace } = mockWorkspace({
        workspaces: [personalWorkspace],
        isSwitching,
        switchSucceeds
      })

      const outcome =
        await useWorkspaceCreditsSource().switchToPersonalWorkspace()

      expect(switchWorkspace).toHaveBeenCalledWith('ws-personal')
      expect(outcome).toBe(expected)
    }
  )

  it('stays in place when there is no personal workspace', async () => {
    const { switchWorkspace } = mockWorkspace({ workspaces: [] })

    const outcome =
      await useWorkspaceCreditsSource().switchToPersonalWorkspace()

    expect(switchWorkspace).not.toHaveBeenCalled()
    expect(outcome).toBe('active')
  })

  it('fails without switching when the workspaces cannot load', async () => {
    const { switchWorkspace } = mockWorkspace({ workspaces: [] })
    vi.mocked(useTeamWorkspaceStore().initialize).mockRejectedValue(
      new Error('workspace list failed')
    )

    const outcome =
      await useWorkspaceCreditsSource().switchToPersonalWorkspace()

    expect(switchWorkspace).not.toHaveBeenCalled()
    expect(outcome).toBe('failed')
  })
})
