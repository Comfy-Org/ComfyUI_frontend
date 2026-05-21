import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSubscriptionActions } from '@/platform/cloud/subscription/composables/useSubscriptionActions'

// Mock dependencies
const mockFetchBalance = vi.fn()
const mockFetchStatus = vi.fn()
const mockShowTopUpCreditsDialog = vi.fn()
const mockOpenSupport = vi.fn()

vi.mock('@/composables/auth/useAuthActions', () => ({
  useAuthActions: () => ({
    fetchBalance: mockFetchBalance
  })
}))

vi.mock('@/platform/cloud/subscription/composables/useSubscription', () => ({
  useSubscription: () => ({
    fetchStatus: mockFetchStatus
  })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    fetchStatus: mockFetchStatus
  })
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    showTopUpCreditsDialog: mockShowTopUpCreditsDialog
  })
}))

vi.mock('@/platform/support/useSupportContext', () => ({
  useSupportContext: () => ({
    openSupport: mockOpenSupport
  })
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
  })

  describe('handleAddApiCredits', () => {
    it('should call showTopUpCreditsDialog', () => {
      const { handleAddApiCredits } = useSubscriptionActions()
      handleAddApiCredits()
      expect(mockShowTopUpCreditsDialog).toHaveBeenCalledOnce()
    })
  })

  describe('handleMessageSupport', () => {
    it('opens the Pylon billing form and resets loading state', () => {
      const { handleMessageSupport, isLoadingSupport } =
        useSubscriptionActions()

      expect(isLoadingSupport.value).toBe(false)

      handleMessageSupport()

      expect(mockOpenSupport).toHaveBeenCalledWith('billing-refund-issue', {
        productArea: 'Billing'
      })
      expect(isLoadingSupport.value).toBe(false)
    })

    it('handles errors gracefully', () => {
      mockOpenSupport.mockImplementationOnce(() => {
        throw new Error('open failed')
      })
      const { handleMessageSupport, isLoadingSupport } =
        useSubscriptionActions()

      handleMessageSupport()
      expect(isLoadingSupport.value).toBe(false)
    })
  })

  describe('handleRefresh', () => {
    it('should call both fetchBalance and fetchStatus', async () => {
      const { handleRefresh } = useSubscriptionActions()
      await handleRefresh()

      expect(mockFetchBalance).toHaveBeenCalledOnce()
      expect(mockFetchStatus).toHaveBeenCalledOnce()
    })

    it('should handle errors gracefully', async () => {
      mockFetchBalance.mockRejectedValueOnce(new Error('Fetch failed'))
      const { handleRefresh } = useSubscriptionActions()

      // Should not throw
      await expect(handleRefresh()).resolves.toBeUndefined()
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
