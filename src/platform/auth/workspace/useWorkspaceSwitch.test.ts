import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useWorkspaceSwitch } from '@/platform/auth/workspace/useWorkspaceSwitch'

const mockSwitchWorkspace = vi.hoisted(() => vi.fn())
const mockCurrentWorkspace = vi.hoisted(() => ({
  value: null as { id: string } | null
}))

vi.mock('@/platform/auth/workspace/useWorkspaceAuth', () => ({
  useWorkspaceAuth: () => ({
    currentWorkspace: mockCurrentWorkspace,
    switchWorkspace: mockSwitchWorkspace
  })
}))

const mockActiveWorkflow = vi.hoisted(() => ({
  value: null as { isModified: boolean } | null
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    get activeWorkflow() {
      return mockActiveWorkflow.value
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
    mockCurrentWorkspace.value = { id: 'workspace-1' }
    mockActiveWorkflow.value = null
    vi.stubGlobal('location', { reload: mockReload })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('hasUnsavedChanges', () => {
    it('returns true when activeWorkflow.isModified is true', () => {
      mockActiveWorkflow.value = { isModified: true }
      const { hasUnsavedChanges } = useWorkspaceSwitch()

      expect(hasUnsavedChanges()).toBe(true)
    })

    it('returns false when activeWorkflow.isModified is false', () => {
      mockActiveWorkflow.value = { isModified: false }
      const { hasUnsavedChanges } = useWorkspaceSwitch()

      expect(hasUnsavedChanges()).toBe(false)
    })

    it('returns false when activeWorkflow is null', () => {
      mockActiveWorkflow.value = null
      const { hasUnsavedChanges } = useWorkspaceSwitch()

      expect(hasUnsavedChanges()).toBe(false)
    })
  })

  describe('switchWithConfirmation', () => {
    it('returns true immediately if switching to the same workspace', async () => {
      mockCurrentWorkspace.value = { id: 'workspace-1' }
      const { switchWithConfirmation } = useWorkspaceSwitch()

      const result = await switchWithConfirmation('workspace-1')

      expect(result).toBe(true)
      expect(mockSwitchWorkspace).not.toHaveBeenCalled()
      expect(mockConfirm).not.toHaveBeenCalled()
    })

    it('switches directly without dialog when no unsaved changes', async () => {
      mockCurrentWorkspace.value = { id: 'workspace-1' }
      mockActiveWorkflow.value = { isModified: false }
      mockSwitchWorkspace.mockResolvedValue(undefined)
      const { switchWithConfirmation } = useWorkspaceSwitch()

      const result = await switchWithConfirmation('workspace-2')

      expect(result).toBe(true)
      expect(mockConfirm).not.toHaveBeenCalled()
      expect(mockSwitchWorkspace).toHaveBeenCalledWith('workspace-2')
      expect(mockReload).toHaveBeenCalled()
    })

    it('shows confirmation dialog when there are unsaved changes', async () => {
      mockCurrentWorkspace.value = { id: 'workspace-1' }
      mockActiveWorkflow.value = { isModified: true }
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
      mockCurrentWorkspace.value = { id: 'workspace-1' }
      mockActiveWorkflow.value = { isModified: true }
      mockConfirm.mockResolvedValue(false)
      const { switchWithConfirmation } = useWorkspaceSwitch()

      const result = await switchWithConfirmation('workspace-2')

      expect(result).toBe(false)
      expect(mockSwitchWorkspace).not.toHaveBeenCalled()
      expect(mockReload).not.toHaveBeenCalled()
    })

    it('calls switchWorkspace and reloads page after user confirms', async () => {
      mockCurrentWorkspace.value = { id: 'workspace-1' }
      mockActiveWorkflow.value = { isModified: true }
      mockConfirm.mockResolvedValue(true)
      mockSwitchWorkspace.mockResolvedValue(undefined)
      const { switchWithConfirmation } = useWorkspaceSwitch()

      const result = await switchWithConfirmation('workspace-2')

      expect(result).toBe(true)
      expect(mockSwitchWorkspace).toHaveBeenCalledWith('workspace-2')
      expect(mockReload).toHaveBeenCalled()
    })

    it('returns false if switchWorkspace throws an error', async () => {
      mockCurrentWorkspace.value = { id: 'workspace-1' }
      mockActiveWorkflow.value = { isModified: false }
      mockSwitchWorkspace.mockRejectedValue(new Error('Switch failed'))
      const { switchWithConfirmation } = useWorkspaceSwitch()

      const result = await switchWithConfirmation('workspace-2')

      expect(result).toBe(false)
      expect(mockReload).not.toHaveBeenCalled()
    })
  })
})
