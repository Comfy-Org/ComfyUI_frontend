import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthActions } from '@/composables/auth/useAuthActions'

const {
  mockConfirm,
  mockAuthLogout,
  mockSaveWorkflow,
  mockModifiedWorkflows,
  mockToastAdd
} = vi.hoisted(() => ({
  mockConfirm: vi.fn(),
  mockAuthLogout: vi.fn(),
  mockSaveWorkflow: vi.fn(),
  mockModifiedWorkflows: { value: [] as Array<{ path: string }> },
  mockToastAdd: vi.fn()
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    confirm: mockConfirm,
    showSignInDialog: vi.fn()
  })
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    logout: mockAuthLogout
  })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    get modifiedWorkflows() {
      return mockModifiedWorkflows.value
    }
  })
}))

vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: () => ({
    saveWorkflow: mockSaveWorkflow
  })
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({
    add: mockToastAdd
  })
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => null
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    isActiveSubscription: { value: false }
  })
}))

describe('useAuthActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createTestingPinia())
    mockModifiedWorkflows.value = []
    mockAuthLogout.mockResolvedValue(undefined)
    mockSaveWorkflow.mockResolvedValue(undefined)
  })

  describe('logout', () => {
    it('should log out directly when no modified workflows exist', async () => {
      const { logout } = useAuthActions()

      await logout()

      expect(mockConfirm).not.toHaveBeenCalled()
      expect(mockAuthLogout).toHaveBeenCalledOnce()
    })

    it('should show unsaved changes dialog when modified workflows exist', async () => {
      mockModifiedWorkflows.value = [{ path: 'workflow1.json' }]
      mockConfirm.mockResolvedValue(false)

      const { logout } = useAuthActions()
      await logout()

      expect(mockConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'dirtyClose' })
      )
    })

    it('should cancel logout when user closes the dialog', async () => {
      mockModifiedWorkflows.value = [{ path: 'workflow1.json' }]
      mockConfirm.mockResolvedValue(null)

      const { logout } = useAuthActions()
      await logout()

      expect(mockAuthLogout).not.toHaveBeenCalled()
      expect(mockSaveWorkflow).not.toHaveBeenCalled()
    })

    it('should save all modified workflows then log out when user clicks Save', async () => {
      const workflows = [{ path: 'workflow1.json' }, { path: 'workflow2.json' }]
      mockModifiedWorkflows.value = workflows
      mockConfirm.mockResolvedValue(true)

      const { logout } = useAuthActions()
      await logout()

      expect(mockSaveWorkflow).toHaveBeenCalledTimes(2)
      expect(mockSaveWorkflow).toHaveBeenCalledWith(workflows[0])
      expect(mockSaveWorkflow).toHaveBeenCalledWith(workflows[1])
      expect(mockAuthLogout).toHaveBeenCalledOnce()

      const lastSaveOrder = Math.max(
        ...mockSaveWorkflow.mock.invocationCallOrder
      )
      const logoutOrder = mockAuthLogout.mock.invocationCallOrder[0]
      expect(lastSaveOrder).toBeLessThan(logoutOrder)
    })

    it('should not log out when saving a workflow fails', async () => {
      mockModifiedWorkflows.value = [{ path: 'workflow1.json' }]
      mockConfirm.mockResolvedValue(true)
      mockSaveWorkflow.mockRejectedValueOnce(new Error('Save failed'))

      const { logout } = useAuthActions()
      await logout()

      expect(mockSaveWorkflow).toHaveBeenCalledOnce()
      expect(mockAuthLogout).not.toHaveBeenCalled()
    })

    it("should log out without saving when user clicks Don't Save", async () => {
      mockModifiedWorkflows.value = [{ path: 'workflow1.json' }]
      mockConfirm.mockResolvedValue(false)

      const { logout } = useAuthActions()
      await logout()

      expect(mockSaveWorkflow).not.toHaveBeenCalled()
      expect(mockAuthLogout).toHaveBeenCalledOnce()
    })

    it('should show success toast after logout', async () => {
      const { logout } = useAuthActions()
      await logout()

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success' })
      )
    })
  })
})
