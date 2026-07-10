import { FirebaseError } from 'firebase/app'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthActions } from '@/composables/auth/useAuthActions'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'

type ModifiedWorkflow = Pick<ComfyWorkflow, 'path' | 'isModified'>

const mockAuthStore = vi.hoisted(() => ({
  logout: vi.fn().mockResolvedValue(undefined),
  sendPasswordReset: vi.fn().mockResolvedValue(undefined),
  initiateCreditPurchase: vi.fn(),
  accessBillingPortal: vi.fn(),
  fetchBalance: vi.fn(),
  loginWithGoogle: vi.fn(),
  loginWithGithub: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  updatePassword: vi.fn().mockResolvedValue(undefined)
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

const mockBillingContext = vi.hoisted(() => ({
  isActiveSubscription: { value: false },
  isFreeTier: { value: true },
  type: { value: 'free' }
}))

const mockTelemetry = vi.hoisted(() => ({
  startTopupTracking: vi.fn()
}))

const knownAuthErrorCodes = new Set([
  'auth/invalid-credential',
  'auth/email-already-in-use'
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
  useTelemetry: vi.fn(() => mockTelemetry)
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
  useBillingContext: vi.fn(() => mockBillingContext)
}))

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({
    wrapWithErrorHandlingAsync: <TArgs extends unknown[], TReturn>(
      action: (...args: TArgs) => Promise<TReturn> | TReturn
    ) => action,
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
    mockBillingContext.isActiveSubscription.value = false
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

  it('shows the unauthorized-domain access error message', () => {
    const { reportError, accessError } = useAuthActions()

    reportError(new FirebaseError('auth/unauthorized-domain', 'blocked'))

    expect(accessError.value).toBe(true)
    expect(mockToastStore.add).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'g.error',
      detail: 'toastMessages.unauthorizedDomain'
    })
  })
})

describe('useAuthActions account actions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockBillingContext.isActiveSubscription.value = false
    vi.stubGlobal(
      'open',
      vi.fn(() => ({}))
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends password reset emails and shows success toast', async () => {
    const { sendPasswordReset } = useAuthActions()

    await sendPasswordReset('user@example.com')

    expect(mockAuthStore.sendPasswordReset).toHaveBeenCalledWith(
      'user@example.com'
    )
    expect(mockToastStore.add).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'success',
        summary: 'auth.login.passwordResetSent'
      })
    )
  })

  it('does not purchase credits without an active subscription', async () => {
    const { purchaseCredits } = useAuthActions()

    await purchaseCredits(25)

    expect(mockAuthStore.initiateCreditPurchase).not.toHaveBeenCalled()
    expect(window.open).not.toHaveBeenCalled()
  })

  it('opens checkout and tracks top-up starts for credit purchases', async () => {
    mockBillingContext.isActiveSubscription.value = true
    mockAuthStore.initiateCreditPurchase.mockResolvedValueOnce({
      checkout_url: 'https://checkout.example.test'
    })
    const { purchaseCredits } = useAuthActions()

    await purchaseCredits(25)

    expect(mockAuthStore.initiateCreditPurchase).toHaveBeenCalledWith({
      amount_micros: 25000000,
      currency: 'usd'
    })
    expect(mockTelemetry.startTopupTracking).toHaveBeenCalledOnce()
    expect(window.open).toHaveBeenCalledWith(
      'https://checkout.example.test',
      '_blank'
    )
  })

  it('throws when credit checkout URL is missing', async () => {
    mockBillingContext.isActiveSubscription.value = true
    mockAuthStore.initiateCreditPurchase.mockResolvedValueOnce({})
    const { purchaseCredits } = useAuthActions()

    await expect(purchaseCredits(10)).rejects.toThrow(
      'toastMessages.failedToPurchaseCredits'
    )
  })

  it('opens the billing portal in a new tab by default', async () => {
    mockAuthStore.accessBillingPortal.mockResolvedValueOnce({
      billing_portal_url: 'https://billing.example.test'
    })
    const { accessBillingPortal } = useAuthActions()

    await expect(accessBillingPortal('pro')).resolves.toBe(true)

    expect(mockAuthStore.accessBillingPortal).toHaveBeenCalledWith('pro')
    expect(window.open).toHaveBeenCalledWith(
      'https://billing.example.test',
      '_blank'
    )
  })

  it('throws when billing portal URL is missing', async () => {
    mockAuthStore.accessBillingPortal.mockResolvedValueOnce({})
    const { accessBillingPortal } = useAuthActions()

    await expect(accessBillingPortal()).rejects.toThrow(
      'toastMessages.failedToAccessBillingPortal'
    )
  })

  it('delegates balance and sign-in methods to the auth store', async () => {
    mockAuthStore.fetchBalance.mockResolvedValueOnce({ balance: 12 })
    mockAuthStore.loginWithGoogle.mockResolvedValueOnce('google')
    mockAuthStore.loginWithGithub.mockResolvedValueOnce('github')
    mockAuthStore.login.mockResolvedValueOnce('email')
    mockAuthStore.register.mockResolvedValueOnce('registered')
    const actions = useAuthActions()

    await expect(actions.fetchBalance()).resolves.toEqual({ balance: 12 })
    await expect(actions.signInWithGoogle({ isNewUser: true })).resolves.toBe(
      'google'
    )
    await expect(actions.signInWithGithub({ isNewUser: false })).resolves.toBe(
      'github'
    )
    await expect(actions.signInWithEmail('u@example.com', 'pw')).resolves.toBe(
      'email'
    )
    await expect(
      actions.signUpWithEmail('u@example.com', 'pw', 'turnstile')
    ).resolves.toBe('registered')

    expect(mockAuthStore.loginWithGoogle).toHaveBeenCalledWith({
      isNewUser: true
    })
    expect(mockAuthStore.loginWithGithub).toHaveBeenCalledWith({
      isNewUser: false
    })
    expect(mockAuthStore.login).toHaveBeenCalledWith('u@example.com', 'pw')
    expect(mockAuthStore.register).toHaveBeenCalledWith(
      'u@example.com',
      'pw',
      'turnstile'
    )
  })

  it('updates passwords and shows success toast', async () => {
    const { updatePassword } = useAuthActions()

    await updatePassword('new-password')

    expect(mockAuthStore.updatePassword).toHaveBeenCalledWith('new-password')
    expect(mockToastStore.add).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'success',
        summary: 'auth.passwordUpdate.success'
      })
    )
  })
})
