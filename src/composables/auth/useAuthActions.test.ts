import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthActions } from '@/composables/auth/useAuthActions'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'

type ModifiedWorkflow = Pick<ComfyWorkflow, 'path' | 'isModified'>

const mockAuthStore = vi.hoisted(() => ({
  logout: vi.fn().mockResolvedValue(undefined)
}))

const mockToastStore = vi.hoisted(() => ({
  add: vi.fn()
}))

const mockWorkflowStore = vi.hoisted(() => ({
  modifiedWorkflows: [] as ModifiedWorkflow[]
}))

const mockWorkflowService = vi.hoisted(() => ({
  saveWorkflow: vi.fn().mockResolvedValue(true)
}))

const mockDialogService = vi.hoisted(() => ({
  confirm: vi.fn()
}))

vi.mock('@/i18n', () => ({
  t: (key: string, values?: { workflow?: string }) =>
    values?.workflow ? `${key}:${values.workflow}` : key
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: vi.fn(() => undefined)
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: vi.fn(() => mockToastStore)
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: vi.fn(() => mockWorkflowStore)
}))

vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: vi.fn(() => mockWorkflowService)
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: vi.fn(() => mockDialogService)
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(() => mockAuthStore)
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: vi.fn(() => ({
    isActiveSubscription: { value: false },
    isFreeTier: { value: true },
    type: { value: 'free' }
  }))
}))

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({
    wrapWithErrorHandlingAsync: <TArgs extends unknown[], TReturn>(
      action: (...args: TArgs) => Promise<TReturn> | TReturn
    ) => action,
    toastErrorHandler: vi.fn()
  })
}))

function makeWorkflow(path: string): ModifiedWorkflow {
  return { path, isModified: true } satisfies ModifiedWorkflow
}

describe('useAuthActions.logout', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockWorkflowStore.modifiedWorkflows = []
  })

  it('logs out without prompting when no workflows are modified', async () => {
    const { logout } = useAuthActions()

    await logout()

    expect(mockDialogService.confirm).not.toHaveBeenCalled()
    expect(mockWorkflowService.saveWorkflow).not.toHaveBeenCalled()
    expect(mockAuthStore.logout).toHaveBeenCalledTimes(1)
  })

  it('cancels sign-out when the dialog is dismissed (null)', async () => {
    mockWorkflowStore.modifiedWorkflows = [makeWorkflow('a.json')]
    mockDialogService.confirm.mockResolvedValueOnce(null)
    const { logout } = useAuthActions()

    await logout()

    expect(mockDialogService.confirm).toHaveBeenCalledTimes(1)
    expect(mockWorkflowService.saveWorkflow).not.toHaveBeenCalled()
    expect(mockAuthStore.logout).not.toHaveBeenCalled()
  })

  it('signs out without saving when the user picks "Sign out anyway" (false)', async () => {
    mockWorkflowStore.modifiedWorkflows = [makeWorkflow('a.json')]
    mockDialogService.confirm.mockResolvedValueOnce(false)
    const { logout } = useAuthActions()

    await logout()

    expect(mockDialogService.confirm).toHaveBeenCalledTimes(1)
    expect(mockWorkflowService.saveWorkflow).not.toHaveBeenCalled()
    expect(mockAuthStore.logout).toHaveBeenCalledTimes(1)
  })

  it('cancels sign-out when saving a workflow is cancelled', async () => {
    mockWorkflowStore.modifiedWorkflows = [makeWorkflow('a.json')]
    mockDialogService.confirm.mockResolvedValueOnce(true)
    mockWorkflowService.saveWorkflow.mockResolvedValueOnce(false)
    const { logout } = useAuthActions()

    await logout()

    expect(mockWorkflowService.saveWorkflow).toHaveBeenCalledTimes(1)
    expect(mockAuthStore.logout).not.toHaveBeenCalled()
  })

  it('does not log out if a workflow save fails', async () => {
    mockWorkflowStore.modifiedWorkflows = [
      makeWorkflow('a.json'),
      makeWorkflow('b.json')
    ]
    mockDialogService.confirm.mockResolvedValueOnce(true)
    mockWorkflowService.saveWorkflow.mockRejectedValueOnce(
      new Error('disk full')
    )
    const { logout } = useAuthActions()

    await expect(logout()).rejects.toThrow('auth.signOut.saveFailed:a.json')

    expect(mockWorkflowService.saveWorkflow).toHaveBeenCalledTimes(1)
    expect(mockAuthStore.logout).not.toHaveBeenCalled()
  })

  it('saves every modified workflow before signing out when user picks Save (true)', async () => {
    const workflows = [makeWorkflow('a.json'), makeWorkflow('b.json')]
    mockWorkflowStore.modifiedWorkflows = workflows
    mockDialogService.confirm.mockResolvedValueOnce(true)
    const { logout } = useAuthActions()

    await logout()

    expect(mockWorkflowService.saveWorkflow).toHaveBeenCalledTimes(2)
    expect(mockWorkflowService.saveWorkflow).toHaveBeenNthCalledWith(
      1,
      workflows[0]
    )
    expect(mockWorkflowService.saveWorkflow).toHaveBeenNthCalledWith(
      2,
      workflows[1]
    )
    expect(mockAuthStore.logout).toHaveBeenCalledTimes(1)
    expect(
      mockWorkflowService.saveWorkflow.mock.invocationCallOrder[1]
    ).toBeLessThan(mockAuthStore.logout.mock.invocationCallOrder[0])
    expect(
      mockWorkflowService.saveWorkflow.mock.invocationCallOrder[0]
    ).toBeLessThan(mockWorkflowService.saveWorkflow.mock.invocationCallOrder[1])
  })

  it('passes denyLabel "Sign out anyway" to the dialog', async () => {
    mockWorkflowStore.modifiedWorkflows = [makeWorkflow('a.json')]
    mockDialogService.confirm.mockResolvedValueOnce(null)
    const { logout } = useAuthActions()

    await logout()

    expect(mockDialogService.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'dirtyClose',
        title: 'auth.signOut.unsavedChangesTitle',
        message: 'auth.signOut.unsavedChangesMessage',
        denyLabel: 'auth.signOut.signOutAnyway'
      })
    )
  })
})
