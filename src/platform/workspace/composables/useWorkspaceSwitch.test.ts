import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useWorkspaceSwitch } from '@/platform/workspace/composables/useWorkspaceSwitch'
import type { WorkspaceWithRole } from '@/platform/workspace/api/workspaceApi'

const mockSwitchWorkspace = vi.hoisted(() => vi.fn())
const mockActiveWorkspace = vi.hoisted(() => ({
  value: null as WorkspaceWithRole | null
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    switchWorkspace: mockSwitchWorkspace
  })
}))

vi.mock('pinia', () => ({
  storeToRefs: () => ({
    activeWorkspace: mockActiveWorkspace
  })
}))

describe('useWorkspaceSwitch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActiveWorkspace.value = {
      id: 'workspace-1',
      name: 'Test Workspace',
      type: 'personal',
      role: 'owner',
      created_at: '2026-01-01T00:00:00Z',
      joined_at: '2026-01-01T00:00:00Z'
    }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('switchWorkspace', () => {
    it('returns true immediately if switching to the same workspace', async () => {
      const { switchWorkspace } = useWorkspaceSwitch()

      const result = await switchWorkspace('workspace-1')

      expect(result).toBe(true)
      expect(mockSwitchWorkspace).not.toHaveBeenCalled()
    })

    it('switches directly to the new workspace', async () => {
      mockSwitchWorkspace.mockResolvedValue(undefined)
      const { switchWorkspace } = useWorkspaceSwitch()

      const result = await switchWorkspace('workspace-2')

      expect(result).toBe(true)
      expect(mockSwitchWorkspace).toHaveBeenCalledWith('workspace-2')
    })

    it('returns false if switchWorkspace throws an error', async () => {
      mockSwitchWorkspace.mockRejectedValue(new Error('Switch failed'))
      const { switchWorkspace } = useWorkspaceSwitch()

      const result = await switchWorkspace('workspace-2')

      expect(result).toBe(false)
    })
  })
})
