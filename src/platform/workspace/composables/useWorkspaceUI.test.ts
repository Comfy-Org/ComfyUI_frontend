import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { EffectScope } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { WorkspaceWithRole } from '@/platform/workspace/api/workspaceApi'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

vi.mock(import('@/composables/useFeatureFlags'))

const personal: WorkspaceWithRole = {
  id: 'personal',
  name: 'Personal',
  type: 'personal',
  role: 'owner',
  created_at: '2026-01-01T00:00:00Z',
  joined_at: '2026-01-01T00:00:00Z'
}

describe('workspace membership presentation', () => {
  let scope: EffectScope

  beforeEach(() => {
    scope = effectScope()
    vi.mocked(useTeamWorkspaceStore().ensureMembersLoaded).mockResolvedValue()
  })

  afterEach(() => scope.stop())

  it.for([
    {
      type: 'personal',
      role: 'owner',
      canViewOtherMembers: false,
      canViewPendingInvites: false
    },
    {
      type: 'personal',
      role: 'member',
      canViewOtherMembers: true,
      canViewPendingInvites: false
    },
    {
      type: 'team',
      role: 'owner',
      canViewOtherMembers: true,
      canViewPendingInvites: true
    },
    {
      type: 'team',
      role: 'member',
      canViewOtherMembers: true,
      canViewPendingInvites: false
    }
  ] as const)(
    'shows membership sections for a $type $role',
    ({ type, role, canViewOtherMembers, canViewPendingInvites }) => {
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspace: { ...personal, type, role }
      })

      const ui = scope.run(useWorkspaceUI)

      expect(ui?.permissions.value).toEqual({
        canViewOtherMembers,
        canViewPendingInvites
      })
    }
  )

  it('loads owner membership when the active workspace role changes', async () => {
    const store = useTeamWorkspaceStore()
    Object.assign(store, {
      activeWorkspace: { ...personal, role: 'member' }
    })
    scope.run(useWorkspaceUI)
    expect(store.ensureMembersLoaded).not.toHaveBeenCalled()

    Object.assign(store, { activeWorkspace: personal })
    await nextTick()

    expect(store.ensureMembersLoaded).toHaveBeenCalledOnce()
  })

  it.for([true, false])(
    'uses the member credit limit layout when enabled is %s',
    (enabled) => {
      Object.assign(useTeamWorkspaceStore(), {
        activeWorkspace: { ...personal, type: 'team' }
      })
      vi.mocked(useFeatureFlags().flags).memberCreditLimitsEnabled = enabled

      const ui = scope.run(useWorkspaceUI)

      expect(ui?.uiConfig.value.showCreditsColumn).toBe(enabled)
      expect(ui?.uiConfig.value.membersGridCols).toBe(
        enabled ? 'grid-cols-[38%_18%_30%_14%]' : 'grid-cols-[50%_40%_10%]'
      )
    }
  )
})
