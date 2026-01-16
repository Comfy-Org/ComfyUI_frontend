import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useWorkspaceSwitch } from '@/platform/auth/workspace/useWorkspaceSwitch'
import type { WorkspaceWithRole } from '@/platform/auth/workspace/workspaceTypes'

const mockSwitchWorkspace = vi.hoisted(() => vi.fn())
const mockCurrentWorkspace = vi.hoisted(() => ({
  value: null as WorkspaceWithRole | null
}))

vi.mock('@/stores/workspaceAuthStore', () => ({
  useWorkspaceAuthStore: () => ({
    switchWorkspace: mockSwitchWorkspace
  })
}))

vi.mock('pinia', () => ({
  storeToRefs: () => ({
    currentWorkspace: mockCurrentWorkspace
  })
}))

const mockModifiedWorkflows = vi.hoisted(
  () => [] as Array<{ isModified: boolean }>
)

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    get modifiedWorkflows() {
      return mockModifiedWorkflows
    }
  })
}))

const mockConfirm = vi.hoisted(() => vi.fn())

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    confirm: mockConfirm
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

const mockReload = vi.fn()

describe('useWorkspaceSwitch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCurrentWorkspace.value = {
      id: 'workspace-1',
      name: 'Test Workspace',
      type: 'personal',
      role: 'owner'
    }
    mockModifiedWorkflows.length = 0
    vi.stubGlobal('location', { reload: mockReload })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('hasUnsavedChanges', () => {
    it('returns true when there are modified workflows', () => {
      mockModifiedWorkflows.push({ isModified: true })
      const { hasUnsavedChanges } = useWorkspaceSwitch()

      expect(hasUnsavedChanges()).toBe(true)
    })

    it('returns true when multiple workflows are modified', () => {
      mockModifiedWorkflows.push({ isModified: true }, { isModified: true })
      const { hasUnsavedChanges } = useWorkspaceSwitch()

      expect(hasUnsavedChanges()).toBe(true)
    })

    it('returns false when no workflows are modified', () => {
      mockModifiedWorkflows.length = 0
      const { hasUnsavedChanges } = useWorkspaceSwitch()

      expect(hasUnsavedChanges()).toBe(false)
    })
  })

  describe('switchWithConfirmation', () => {
    it('returns true immediately if switching to the same workspace', async () => {
      const { switchWithConfirmation } = useWorkspaceSwitch()

      const result = await switchWithConfirmation('workspace-1')

      expect(result).toBe(true)
      expect(mockSwitchWorkspace).not.toHaveBeenCalled()
      expect(mockConfirm).not.toHaveBeenCalled()
    })

    it('switches directly without dialog when no unsaved changes', async () => {
      mockModifiedWorkflows.length = 0
      mockSwitchWorkspace.mockResolvedValue(undefined)
      const { switchWithConfirmation } = useWorkspaceSwitch()

      const result = await switchWithConfirmation('workspace-2')

      expect(result).toBe(true)
      expect(mockConfirm).not.toHaveBeenCalled()
      expect(mockSwitchWorkspace).toHaveBeenCalledWith('workspace-2')
      expect(mockReload).toHaveBeenCalled()
    })

    it('shows confirmation dialog when there are unsaved changes', async () => {
      mockModifiedWorkflows.push({ isModified: true })
      mockConfirm.mockResolvedValue(true)
      mockSwitchWorkspace.mockResolvedValue(undefined)
      const { switchWithConfirmation } = useWorkspaceSwitch()

      await switchWithConfirmation('workspace-2')

      expect(mockConfirm).toHaveBeenCalledWith({
        title: 'workspace.unsavedChanges.title',
        message: 'workspace.unsavedChanges.message',
        type: 'dirtyClose'
      })
    })

    it('returns false if user cancels the confirmation dialog', async () => {
      mockModifiedWorkflows.push({ isModified: true })
      mockConfirm.mockResolvedValue(false)
      const { switchWithConfirmation } = useWorkspaceSwitch()

      const result = await switchWithConfirmation('workspace-2')

      expect(result).toBe(false)
      expect(mockSwitchWorkspace).not.toHaveBeenCalled()
      expect(mockReload).not.toHaveBeenCalled()
    })

    it('calls switchWorkspace and reloads page after user confirms', async () => {
      mockModifiedWorkflows.push({ isModified: true })
      mockConfirm.mockResolvedValue(true)
      mockSwitchWorkspace.mockResolvedValue(undefined)
      const { switchWithConfirmation } = useWorkspaceSwitch()

      const result = await switchWithConfirmation('workspace-2')

      expect(result).toBe(true)
      expect(mockSwitchWorkspace).toHaveBeenCalledWith('workspace-2')
      expect(mockReload).toHaveBeenCalled()
    })

    it('returns false if switchWorkspace throws an error', async () => {
      mockModifiedWorkflows.length = 0
      mockSwitchWorkspace.mockRejectedValue(new Error('Switch failed'))
      const { switchWithConfirmation } = useWorkspaceSwitch()

      const result = await switchWithConfirmation('workspace-2')

      expect(result).toBe(false)
      expect(mockReload).not.toHaveBeenCalled()
    })
  })
})
