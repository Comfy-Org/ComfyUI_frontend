import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useWorkspaceSwitch } from '@/platform/workspace/composables/useWorkspaceSwitch'

beforeEach(() => {
  vi.mocked(useTeamWorkspaceStore().switchWorkspace).mockResolvedValue(true)
})

describe('useWorkspaceSwitch', () => {
  beforeEach(() => {
    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspace: {
        id: 'workspace-1',
        name: 'Test Workspace',
        type: 'personal',
        role: 'owner',
        created_at: '2026-01-01T00:00:00Z',
        joined_at: '2026-01-01T00:00:00Z'
      }
    })
  })

  describe('switchWorkspace', () => {
    it('returns true immediately if switching to the same workspace', async () => {
      const { switchWorkspace } = useWorkspaceSwitch()

      const result = await switchWorkspace('workspace-1')

      expect(result).toBe(true)
      expect(useTeamWorkspaceStore().switchWorkspace).not.toHaveBeenCalled()
    })

    it('defers to the store for the active workspace while a switch is in progress', async () => {
      Object.assign(useTeamWorkspaceStore(), { isSwitching: true })
      vi.mocked(useTeamWorkspaceStore().switchWorkspace).mockResolvedValue(
        false
      )
      const { switchWorkspace } = useWorkspaceSwitch()

      const result = await switchWorkspace('workspace-1')

      expect(result).toBe(false)
      expect(useTeamWorkspaceStore().switchWorkspace).toHaveBeenCalledWith(
        'workspace-1'
      )
    })

    it('switches directly to the new workspace', async () => {
      vi.mocked(useTeamWorkspaceStore().switchWorkspace).mockResolvedValue(true)
      const { switchWorkspace } = useWorkspaceSwitch()

      const result = await switchWorkspace('workspace-2')

      expect(result).toBe(true)
      expect(useTeamWorkspaceStore().switchWorkspace).toHaveBeenCalledWith(
        'workspace-2'
      )
    })

    it('returns false if the store refuses the switch', async () => {
      vi.mocked(useTeamWorkspaceStore().switchWorkspace).mockResolvedValue(
        false
      )
      const { switchWorkspace } = useWorkspaceSwitch()

      const result = await switchWorkspace('workspace-2')

      expect(result).toBe(false)
    })

    it('returns false if switchWorkspace throws an error', async () => {
      vi.mocked(useTeamWorkspaceStore().switchWorkspace).mockRejectedValue(
        new Error('Switch failed')
      )
      const { switchWorkspace } = useWorkspaceSwitch()

      const result = await switchWorkspace('workspace-2')

      expect(result).toBe(false)
    })
  })
})
