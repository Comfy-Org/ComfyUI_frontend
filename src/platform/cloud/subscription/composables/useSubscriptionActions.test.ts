import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSubscriptionActions } from '@/platform/cloud/subscription/composables/useSubscriptionActions'

const mockBillingFetchBalance = vi.fn()
const mockAuthFetchBalance = vi.fn()
const mockFetchStatus = vi.fn()
const mockShowTopUpCreditsDialog = vi.fn()
const mockExecute = vi.fn()
const mockToastAdd = vi.fn()

const { mockCaptureException } = vi.hoisted(() => ({
  mockCaptureException: vi.fn()
}))

vi.mock('@sentry/vue', () => ({ captureException: mockCaptureException }))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: mockToastAdd })
}))

vi.mock('@/composables/auth/useAuthActions', () => ({
  useAuthActions: () => ({
    fetchBalance: mockAuthFetchBalance
  })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    fetchBalance: mockBillingFetchBalance,
    fetchStatus: mockFetchStatus
  })
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    showTopUpCreditsDialog: mockShowTopUpCreditsDialog
  })
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({
    execute: mockExecute
  })
}))

// useTelemetry() returns null in OSS, a dispatcher in cloud — toggle via mockIsCloud.
const {
  mockIsCloud,
  mockTrackHelpResourceClicked,
  mockTrackAddApiCreditButtonClicked
} = vi.hoisted(() => ({
  mockIsCloud: { value: true },
  mockTrackHelpResourceClicked: vi.fn(),
  mockTrackAddApiCreditButtonClicked: vi.fn()
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () =>
    mockIsCloud.value
      ? {
          trackHelpResourceClicked: mockTrackHelpResourceClicked,
          trackAddApiCreditButtonClicked: mockTrackAddApiCreditButtonClicked
        }
      : null
}))

// Mock window.open
const mockOpen = vi.fn()
Object.defineProperty(window, 'open', {
  writable: true,
  value: mockOpen
})

describe('useSubscriptionActions', () => {
  beforeEach(() => {
    mockIsCloud.value = true
    mockCaptureException.mockReset()
  })

  describe('handleAddApiCredits', () => {
    it('should call showTopUpCreditsDialog', () => {
      const { handleAddApiCredits } = useSubscriptionActions()
      handleAddApiCredits()
      expect(mockShowTopUpCreditsDialog).toHaveBeenCalledOnce()
      expect(mockTrackAddApiCreditButtonClicked).toHaveBeenCalledWith({
        source: 'settings_billing_panel'
      })
    })
  })

  describe('handleMessageSupport', () => {
    it('should execute support command and manage loading state', async () => {
      const { handleMessageSupport, isLoadingSupport } =
        useSubscriptionActions()

      expect(isLoadingSupport.value).toBe(false)

      const promise = handleMessageSupport()
      expect(isLoadingSupport.value).toBe(true)

      await promise
      expect(mockExecute).toHaveBeenCalledWith('Comfy.ContactSupport', {
        errorHandler: expect.any(Function)
      })
      expect(isLoadingSupport.value).toBe(false)
    })

    it('tracks help-resource telemetry when messaging support in cloud', async () => {
      const { handleMessageSupport } = useSubscriptionActions()

      await handleMessageSupport()

      expect(mockTrackHelpResourceClicked).toHaveBeenCalledWith({
        resource_type: 'help_feedback',
        is_external: true,
        source: 'subscription'
      })
    })

    it('does not fire telemetry when messaging support in OSS builds', async () => {
      mockIsCloud.value = false
      const { handleMessageSupport } = useSubscriptionActions()

      await handleMessageSupport()

      expect(mockTrackHelpResourceClicked).not.toHaveBeenCalled()
    })

    // commandStore.execute runs the command inside its own error handling and
    // resolves either way, handing the failure to the errorHandler it was
    // given. Rejecting from execute() would test a contract it does not have.
    const failCommandVia =
      (thrown: unknown) =>
      async (
        _id: string,
        options?: { errorHandler?: (error: unknown) => void }
      ) => {
        options?.errorHandler?.(thrown)
      }

    it('tells the user when the support command fails, and stops loading', async () => {
      mockExecute.mockImplementationOnce(
        failCommandVia(new Error('Command failed'))
      )
      const { handleMessageSupport, isLoadingSupport } =
        useSubscriptionActions()

      await handleMessageSupport()

      expect(isLoadingSupport.value).toBe(false)
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: 'Command failed'
        })
      )
    })

    it('reports a failed support command so it is visible without the user', async () => {
      const failure = new Error('Command failed')
      mockExecute.mockImplementationOnce(failCommandVia(failure))
      const { handleMessageSupport } = useSubscriptionActions()

      await handleMessageSupport()

      expect(mockCaptureException).toHaveBeenCalledWith(failure, {
        tags: { error_type: 'contact_support_failed' }
      })
    })

    it('reports the support command being unregistered, which does reject', async () => {
      const failure = new Error('Command Comfy.ContactSupport not found')
      mockExecute.mockRejectedValueOnce(failure)
      const { handleMessageSupport, isLoadingSupport } =
        useSubscriptionActions()

      await handleMessageSupport()

      expect(isLoadingSupport.value).toBe(false)
      expect(mockCaptureException).toHaveBeenCalledWith(failure, {
        tags: { error_type: 'contact_support_failed' }
      })
    })

    // Commands run arbitrary registered functions, including ones contributed
    // by extensions, so the thrown value is not guaranteed to be an Error.
    it('reports a thrown non-Error as an Error so it carries a stack', async () => {
      mockExecute.mockImplementationOnce(failCommandVia('Command failed'))
      const { handleMessageSupport } = useSubscriptionActions()

      await handleMessageSupport()

      expect(mockCaptureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Command failed' }),
        { tags: { error_type: 'contact_support_failed' } }
      )
      expect(mockCaptureException.mock.calls[0][0]).toBeInstanceOf(Error)
    })
  })

  describe('handleRefresh', () => {
    it('should refresh balance and status through the billing facade', async () => {
      const { handleRefresh } = useSubscriptionActions()
      await handleRefresh()

      expect(mockBillingFetchBalance).toHaveBeenCalledOnce()
      expect(mockFetchStatus).toHaveBeenCalledOnce()
      expect(mockAuthFetchBalance).not.toHaveBeenCalled()
    })

    it('swallows refresh failures without surfacing a toast', async () => {
      mockBillingFetchBalance.mockRejectedValueOnce(new Error('Fetch failed'))
      const { handleRefresh } = useSubscriptionActions()

      await expect(handleRefresh()).resolves.toBeUndefined()
      expect(mockToastAdd).not.toHaveBeenCalled()
    })
  })

  describe('handleLearnMoreClick', () => {
    it('should open learn more URL', () => {
      const { handleLearnMoreClick } = useSubscriptionActions()
      handleLearnMoreClick()

      expect(mockOpen).toHaveBeenCalledWith(
        'https://docs.comfy.org/get_started/cloud',
        '_blank'
      )
    })
  })
})
