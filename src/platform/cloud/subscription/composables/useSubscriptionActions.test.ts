import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSubscriptionActions } from '@/platform/cloud/subscription/composables/useSubscriptionActions'

const mockBillingFetchBalance = vi.fn()
const mockAuthFetchBalance = vi.fn()
const mockFetchStatus = vi.fn()
const mockShowTopUpCreditsDialog = vi.fn()
const mockExecute = vi.fn()
const mockToastAdd = vi.fn()

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
    vi.clearAllMocks()
    mockIsCloud.value = true
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

    it('should handle errors gracefully', async () => {
      mockExecute.mockRejectedValueOnce(new Error('Command failed'))
      const { handleMessageSupport, isLoadingSupport } =
        useSubscriptionActions()

      await handleMessageSupport()
      expect(isLoadingSupport.value).toBe(false)
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
