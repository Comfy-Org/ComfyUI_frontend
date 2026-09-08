import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSubscriptionActions } from '@/platform/cloud/subscription/composables/useSubscriptionActions'

const mockBillingFetchBalance = vi.fn()
const mockAuthFetchBalance = vi.fn()
const mockFetchStatus = vi.fn()
const mockShowTopUpCreditsDialog = vi.fn()
const mockExecute = vi.fn()
const mockToastAdd = vi.fn()

const { mockReportError } = vi.hoisted(() => ({
  mockReportError: vi.fn()
}))

vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: mockReportError
}))

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
    mockReportError.mockReset()
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
      expect(mockExecute).toHaveBeenCalledWith('Comfy.ContactSupport')
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

    it('tells the user when contacting support fails, and stops loading', async () => {
      mockExecute.mockRejectedValueOnce(new Error('Command failed'))
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

    it('reports a failed support request so it is visible without the user', async () => {
      const failure = new Error('Command failed')
      mockExecute.mockRejectedValueOnce(failure)
      const { handleMessageSupport } = useSubscriptionActions()

      await handleMessageSupport()

      expect(mockReportError).toHaveBeenCalledWith(failure, {
        errorType: 'contact_support_failed'
      })
    })

    // Commands run arbitrary registered functions, including ones contributed
    // by extensions, so the rejected value is not guaranteed to be an Error.
    // Normalizing it is reportError's job, covered in reportError.test.ts; what
    // matters here is that the raw cause reaches the reporter at all.
    it('reports a thrown non-Error', async () => {
      mockExecute.mockRejectedValueOnce('Command failed')
      const { handleMessageSupport } = useSubscriptionActions()

      await handleMessageSupport()

      expect(mockReportError).toHaveBeenCalledWith('Command failed', {
        errorType: 'contact_support_failed'
      })
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
