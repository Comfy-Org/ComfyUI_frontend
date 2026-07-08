import { FirebaseError } from 'firebase/app'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthActions } from '@/composables/auth/useAuthActions'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'

type ModifiedWorkflow = Pick<ComfyWorkflow, 'path' | 'isModified'>

const mockAuthStore = vi.hoisted(() => ({
  login: vi.fn().mockResolvedValue(undefined),
  loginWithGoogle: vi.fn().mockResolvedValue(undefined),
  loginWithGithub: vi.fn().mockResolvedValue(undefined),
  register: vi.fn().mockResolvedValue(undefined),
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

const mockToastErrorHandler = vi.hoisted(() => vi.fn())
const mockTrackAuthFailed = vi.hoisted(() => vi.fn())

const knownAuthErrorCodes = new Set([
  'auth/invalid-credential',
  'auth/email-already-in-use',
  'auth/user-not-found'
])

vi.mock('@/i18n', () => ({
  t: (key: string, values?: { workflow?: string }) =>
    values?.workflow ? `${key}:${values.workflow}` : key,
  st: (key: string, fallback: string) => {
    const code = key.replace('auth.errors.', '')
    return knownAuthErrorCodes.has(code) ? key : fallback
  }
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: vi.fn(() => ({
    trackAuthFailed: mockTrackAuthFailed
  }))
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
    wrapWithErrorHandlingAsync:
      <TArgs extends unknown[], TReturn>(
        action: (...args: TArgs) => Promise<TReturn> | TReturn,
        errorHandler?: (error: unknown) => void
      ) =>
      async (...args: TArgs) => {
        try {
          return await action(...args)
        } catch (error) {
          ;(errorHandler ?? mockToastErrorHandler)(error)
          return undefined
        }
      },
    toastErrorHandler: mockToastErrorHandler
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

    await logout()

    expect(mockWorkflowService.saveWorkflow).toHaveBeenCalledTimes(1)
    expect(mockAuthStore.logout).not.toHaveBeenCalled()
    expect(mockToastErrorHandler).toHaveBeenCalledExactlyOnceWith(
      new Error('auth.signOut.saveFailed:a.json')
    )
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

describe('useAuthActions auth flow error telemetry', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockWorkflowStore.modifiedWorkflows = []
  })

  it('tracks email sign-in Firebase failures and still shows the error toast', async () => {
    const error = new FirebaseError('auth/user-not-found', 'msg')
    mockAuthStore.login.mockRejectedValueOnce(error)
    const { signInWithEmail } = useAuthActions()

    await expect(
      signInWithEmail('user@example.com', 'password')
    ).resolves.toBeUndefined()

    expect(mockTrackAuthFailed).toHaveBeenCalledExactlyOnceWith({
      error_code: 'auth/user-not-found',
      auth_action: 'email_sign_in'
    })
    expect(mockToastStore.add).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'g.error',
      detail: 'auth.errors.auth/user-not-found'
    })
  })

  it('tracks unknown errors for email sign-up failures', async () => {
    const error = new Error('network failed')
    mockAuthStore.register.mockRejectedValueOnce(error)
    const { signUpWithEmail } = useAuthActions()

    await expect(
      signUpWithEmail('user@example.com', 'password')
    ).resolves.toBeUndefined()

    expect(mockTrackAuthFailed).toHaveBeenCalledExactlyOnceWith({
      error_code: 'unknown',
      auth_action: 'email_sign_up'
    })
  })

  it('tracks Google sign-up failures separately from sign-in failures', async () => {
    const error = new FirebaseError('auth/popup-closed-by-user', 'msg')
    mockAuthStore.loginWithGoogle.mockRejectedValueOnce(error)
    const { signInWithGoogle } = useAuthActions()

    await expect(signInWithGoogle({ isNewUser: true })).resolves.toBeUndefined()

    expect(mockTrackAuthFailed).toHaveBeenCalledExactlyOnceWith({
      error_code: 'auth/popup-closed-by-user',
      auth_action: 'google_sign_up'
    })
  })

  it('tracks GitHub sign-up failures separately from sign-in failures', async () => {
    const error = new FirebaseError('auth/popup-closed-by-user', 'msg')
    mockAuthStore.loginWithGithub.mockRejectedValueOnce(error)
    const { signInWithGithub } = useAuthActions()

    await expect(signInWithGithub({ isNewUser: true })).resolves.toBeUndefined()

    expect(mockTrackAuthFailed).toHaveBeenCalledExactlyOnceWith({
      error_code: 'auth/popup-closed-by-user',
      auth_action: 'github_sign_up'
    })
  })

  it('does not track auth failures for logout failures', async () => {
    const error = new FirebaseError('auth/network-request-failed', 'msg')
    mockAuthStore.logout.mockRejectedValueOnce(error)
    const { logout } = useAuthActions()

    await logout()

    expect(mockTrackAuthFailed).not.toHaveBeenCalled()
  })
})

describe('useAuthActions.reportError', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('shows the friendly message for a known Firebase auth code', () => {
    const { reportError } = useAuthActions()

    reportError(new FirebaseError('auth/invalid-credential', 'raw firebase'))

    expect(mockToastStore.add).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'g.error',
      detail: 'auth.errors.auth/invalid-credential'
    })
    expect(mockToastErrorHandler).not.toHaveBeenCalled()
  })

  it('shows the signupBlocked message when the error carries the signup_blocked token', () => {
    const { reportError } = useAuthActions()

    // The backend wraps the rejection in a generic code; we match the token in
    // the message, so it must win over the auth.errors.${code} fallback.
    reportError(
      new FirebaseError(
        'auth/internal-error',
        'Account creation is temporarily unavailable. (ref: signup_blocked)'
      )
    )

    expect(mockToastStore.add).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'g.error',
      detail: 'auth.errors.signupBlocked'
    })
    expect(mockToastErrorHandler).not.toHaveBeenCalled()
  })

  it('matches the signup_blocked token case-insensitively', () => {
    const { reportError } = useAuthActions()

    reportError(
      new FirebaseError('auth/internal-error', 'rejected: SIGNUP_BLOCKED')
    )

    expect(mockToastStore.add).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'g.error',
      detail: 'auth.errors.signupBlocked'
    })
  })

  it('shows the generic fallback for an unknown Firebase auth code', () => {
    const { reportError } = useAuthActions()

    reportError(new FirebaseError('auth/some-new-code', 'raw firebase'))

    expect(mockToastStore.add).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'g.error',
      detail: 'auth.errors.generic'
    })
    expect(mockToastErrorHandler).not.toHaveBeenCalled()
  })

  it('delegates non-Firebase errors to toastErrorHandler', () => {
    const { reportError } = useAuthActions()
    const networkError = new TypeError('Failed to fetch')

    reportError(networkError)

    expect(mockToastErrorHandler).toHaveBeenCalledWith(networkError)
    expect(mockToastStore.add).not.toHaveBeenCalled()
  })
})
