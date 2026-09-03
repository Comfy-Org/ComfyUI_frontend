import { FirebaseError } from 'firebase/app'
import { AuthErrorCodes } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthActions } from '@/composables/auth/useAuthActions'
import enLocale from '@/locales/en/main.json'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'

type ModifiedWorkflow = Pick<ComfyWorkflow, 'path' | 'isModified'>

const mockAuthStore = vi.hoisted(() => ({
  login: vi.fn(async () => undefined),
  loginWithGoogle: vi.fn(async () => undefined),
  loginWithGithub: vi.fn(async () => undefined),
  register: vi.fn(async () => undefined),
  logout: vi.fn(async () => undefined),
  initiateCreditPurchase: vi.fn(
    async (): Promise<{ checkout_url?: string }> => ({
      checkout_url: 'https://checkout.stripe.test'
    })
  )
}))

const mockToastStore = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  loading: vi.fn(),
  custom: vi.fn()
}))

const mockWorkflowStore = vi.hoisted(() => ({
  modifiedWorkflows: [] as ModifiedWorkflow[]
}))

const mockWorkflowService = vi.hoisted(() => ({
  saveWorkflow: vi.fn(async () => true)
}))

const mockDialogService = vi.hoisted(() => ({
  confirm: vi.fn()
}))

const mockToastErrorHandler = vi.hoisted(() => vi.fn())
const mockTrackAuthFailed = vi.hoisted(() => vi.fn())
const mockStartPendingTopup = vi.hoisted(() => vi.fn())
const mockDistributionState = vi.hoisted(() => ({ isCloud: false }))
const mockBillingState = vi.hoisted(() => ({
  canAccessSubscriptionFeatures: false
}))
const mockClearAllWorkflowStorage = vi.hoisted(() => vi.fn())
const mockPrepareWorkflowLogoutTransition = vi.hoisted(() => vi.fn())

const authErrorMessages: Record<string, string> = enLocale.auth.errors

const firebaseCodesWithOwnMessage = Object.keys(authErrorMessages).filter(
  (key) => key.startsWith('auth/')
)

const popupPermissionCodes = [
  AuthErrorCodes.POPUP_CLOSED_BY_USER,
  AuthErrorCodes.EXPIRED_POPUP_REQUEST,
  AuthErrorCodes.POPUP_BLOCKED
]

const accessErrorCodes = [
  'auth/unauthorized-domain',
  'auth/invalid-dynamic-link-domain',
  'auth/unauthorized-continue-uri'
]

vi.mock('@/i18n', () => ({
  t: (key: string, values?: Record<string, string>) =>
    values ? `${key}:${Object.values(values).join(':')}` : key,
  st: (key: string, fallback: string) => {
    const code = key.replace('auth.errors.', '')
    return code in authErrorMessages ? key : fallback
  }
}))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockDistributionState.isCloud
  }
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: vi.fn(() => ({
    trackAuthFailed: mockTrackAuthFailed
  }))
}))

vi.mock('@/composables/billing/usePendingTopup', () => ({
  usePendingTopup: () => ({ startPendingTopup: mockStartPendingTopup })
}))

vi.mock('@/components/ui/toast', () => ({
  useToast: vi.fn(() => mockToastStore)
}))

vi.mock('@/platform/workflow/persistence/base/storageIO', () => ({
  clearAllWorkflowStorage: mockClearAllWorkflowStorage,
  prepareWorkflowLogoutTransition: mockPrepareWorkflowLogoutTransition
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
    canAccessSubscriptionFeatures: {
      value: mockBillingState.canAccessSubscriptionFeatures
    },
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

beforeEach(() => {
  mockDistributionState.isCloud = false
  mockBillingState.canAccessSubscriptionFeatures = false
})

describe('useAuthActions.purchaseCreditsDirect', () => {
  beforeEach(() => {
    mockBillingState.canAccessSubscriptionFeatures = true
  })

  it('starts top-up tracking before opening Stripe checkout', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const { purchaseCreditsDirect } = useAuthActions()

    await purchaseCreditsDirect(25)

    expect(mockStartPendingTopup).toHaveBeenCalledOnce()
    expect(open).toHaveBeenCalledWith('https://checkout.stripe.test', '_blank')
    expect(mockStartPendingTopup.mock.invocationCallOrder[0]).toBeLessThan(
      open.mock.invocationCallOrder[0]
    )
  })

  it('does not start tracking or open checkout when no checkout URL is returned', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    mockAuthStore.initiateCreditPurchase.mockResolvedValueOnce({})
    const { purchaseCreditsDirect } = useAuthActions()

    await expect(purchaseCreditsDirect(25)).rejects.toThrow()

    expect(mockStartPendingTopup).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
  })

  it('does not start tracking or open checkout when the purchase request rejects', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    mockAuthStore.initiateCreditPurchase.mockRejectedValueOnce(
      new Error('network down')
    )
    const { purchaseCreditsDirect } = useAuthActions()

    await expect(purchaseCreditsDirect(25)).rejects.toThrow('network down')

    expect(mockStartPendingTopup).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
  })
})

describe('useAuthActions.logout', () => {
  beforeEach(() => {
    mockDistributionState.isCloud = true
    mockWorkflowStore.modifiedWorkflows = []
  })

  it('logs out on non-cloud distributions without prompting when workflows are modified', async () => {
    mockDistributionState.isCloud = false
    mockWorkflowStore.modifiedWorkflows = [makeWorkflow('a.json')]
    const { logout } = useAuthActions()

    await logout()

    expect(mockDialogService.confirm).not.toHaveBeenCalled()
    expect(mockWorkflowService.saveWorkflow).not.toHaveBeenCalled()
    expect(mockAuthStore.logout).toHaveBeenCalledTimes(1)
    expect(mockClearAllWorkflowStorage).not.toHaveBeenCalled()
  })

  it('logs out without prompting when no workflows are modified', async () => {
    const { logout } = useAuthActions()

    await logout()

    expect(mockDialogService.confirm).not.toHaveBeenCalled()
    expect(mockWorkflowService.saveWorkflow).not.toHaveBeenCalled()
    expect(mockAuthStore.logout).toHaveBeenCalledTimes(1)
  })

  it('clears persisted workflows after cloud logout and before navigation', async () => {
    const navigationSpy = vi
      .spyOn(window.location, 'href', 'set')
      .mockImplementation(() => {})
    const { logout } = useAuthActions()

    await logout()

    expect(mockPrepareWorkflowLogoutTransition).toHaveBeenCalledOnce()
    expect(mockClearAllWorkflowStorage).toHaveBeenCalledExactlyOnceWith()
    expect(mockAuthStore.logout.mock.invocationCallOrder[0]).toBeLessThan(
      mockPrepareWorkflowLogoutTransition.mock.invocationCallOrder[0]
    )
    expect(
      mockPrepareWorkflowLogoutTransition.mock.invocationCallOrder[0]
    ).toBeLessThan(mockClearAllWorkflowStorage.mock.invocationCallOrder[0])
    expect(
      mockClearAllWorkflowStorage.mock.invocationCallOrder[0]
    ).toBeLessThan(navigationSpy.mock.invocationCallOrder[0])
  })

  it('does not clear cloud workflows when logout fails', async () => {
    mockAuthStore.logout.mockRejectedValueOnce(new Error('network failed'))
    const { logout } = useAuthActions()

    await logout()

    expect(mockPrepareWorkflowLogoutTransition).not.toHaveBeenCalled()
    expect(mockClearAllWorkflowStorage).not.toHaveBeenCalled()
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
    expect(mockToastStore.error).toHaveBeenCalledWith('g.error', {
      description: 'auth.errors.auth/user-not-found'
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
  it.for(firebaseCodesWithOwnMessage)(
    'maps %s to its own message rather than the generic fallback',
    (code) => {
      const { reportError } = useAuthActions()

      reportError(new FirebaseError(code, 'raw firebase'))

      const isPopupPermissionCode = popupPermissionCodes.some(
        (popupCode) => popupCode === code
      )
      const toastMethod = isPopupPermissionCode
        ? mockToastStore.warning
        : mockToastStore.error
      const title = isPopupPermissionCode ? 'g.warning' : 'g.error'
      expect(toastMethod).toHaveBeenCalledWith(title, {
        description: `auth.errors.${code}`
      })
      expect(mockToastErrorHandler).not.toHaveBeenCalled()
    }
  )

  it('gives every Firebase code a message distinct from the generic one', () => {
    const generic = authErrorMessages['generic']
    const collisions = firebaseCodesWithOwnMessage.filter(
      (code) => authErrorMessages[code] === generic
    )

    expect(collisions).toEqual([])
  })

  it('covers every popup-permission code with its own message', () => {
    expect(firebaseCodesWithOwnMessage).toEqual(
      expect.arrayContaining(popupPermissionCodes)
    )
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

    expect(mockToastStore.error).toHaveBeenCalledWith('g.error', {
      description: 'auth.errors.signupBlocked'
    })
    expect(mockToastErrorHandler).not.toHaveBeenCalled()
  })

  it('matches the signup_blocked token case-insensitively', () => {
    const { reportError } = useAuthActions()

    reportError(
      new FirebaseError('auth/internal-error', 'rejected: SIGNUP_BLOCKED')
    )

    expect(mockToastStore.error).toHaveBeenCalledWith('g.error', {
      description: 'auth.errors.signupBlocked'
    })
  })

  it('shows the generic fallback for an unknown Firebase auth code', () => {
    const { reportError } = useAuthActions()

    reportError(new FirebaseError('auth/some-new-code', 'raw firebase'))

    expect(mockToastStore.error).toHaveBeenCalledWith('g.error', {
      description: 'auth.errors.generic'
    })
    expect(mockToastErrorHandler).not.toHaveBeenCalled()
  })

  it('delegates non-Firebase errors to toastErrorHandler', () => {
    const { reportError } = useAuthActions()
    const networkError = new TypeError('Failed to fetch')

    reportError(networkError)

    expect(mockToastErrorHandler).toHaveBeenCalledWith(networkError)
    expect(mockToastStore.error).not.toHaveBeenCalled()
  })

  it.for(popupPermissionCodes)(
    'warns rather than errors for %s, since the user or browser caused it',
    (code) => {
      const { reportError } = useAuthActions()

      reportError(new FirebaseError(code, 'raw firebase'))

      expect(mockToastStore.warning).toHaveBeenCalledWith('g.warning', {
        description: `auth.errors.${code}`
      })
      expect(mockToastErrorHandler).not.toHaveBeenCalled()
    }
  )

  it('reports an account collision as an error, not a popup warning', () => {
    const { reportError, accessError } = useAuthActions()

    reportError(
      new FirebaseError('auth/account-exists-with-different-credential', 'raw')
    )

    expect(mockToastStore.error).toHaveBeenCalledWith('g.error', {
      description: 'auth.errors.auth/account-exists-with-different-credential'
    })
    expect(accessError.value).toBe(false)
  })

  it.for(accessErrorCodes)(
    'interpolates the domain and flips accessError for %s',
    (code) => {
      const { reportError, accessError } = useAuthActions()

      reportError(new FirebaseError(code, 'raw firebase'))

      expect(accessError.value).toBe(true)
      expect(mockToastStore.error).toHaveBeenCalledWith('g.error', {
        description: `toastMessages.unauthorizedDomain:${window.location.hostname}:support@comfy.org`
      })
    }
  )

  it('leaves accessError false for auth codes outside the domain group', () => {
    const { reportError, accessError } = useAuthActions()

    reportError(new FirebaseError('auth/popup-blocked', 'raw firebase'))

    expect(accessError.value).toBe(false)
  })
})
