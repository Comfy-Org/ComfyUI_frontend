import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSubscriptionActions } from '@/platform/cloud/subscription/composables/useSubscriptionActions'

// Mock dependencies
const mockFetchBalance = vi.fn()
const mockFetchStatus = vi.fn()
const mockShowTopUpCreditsDialog = vi.fn()
const mockExecute = vi.fn()
const mockT = vi.fn((key: string) => {
  if (key === 'subscription.nextBillingCycle') return 'next billing cycle'
  return key
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: mockT
  })
}))

vi.mock('@/composables/auth/useFirebaseAuthActions', () => ({
  useFirebaseAuthActions: () => ({
    fetchBalance: mockFetchBalance
  })
}))

const mockFormattedRenewalDate = { value: '2024-12-31' }

vi.mock('@/platform/cloud/subscription/composables/useSubscription', () => ({
  useSubscription: () => ({
    fetchStatus: mockFetchStatus,
    formattedRenewalDate: mockFormattedRenewalDate
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

// Mock window.open
const mockOpen = vi.fn()
Object.defineProperty(window, 'open', {
  writable: true,
  value: mockOpen
})

describe('useSubscriptionActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFormattedRenewalDate.value = '2024-12-31'
  })

  describe('refreshTooltip', () => {
    it('should format tooltip with renewal date', () => {
      const { refreshTooltip } = useSubscriptionActions()
      expect(refreshTooltip.value).toBe('Refreshes on 2024-12-31')
    })

    it('should use fallback text when no renewal date', () => {
      mockFormattedRenewalDate.value = ''
      const { refreshTooltip } = useSubscriptionActions()
      expect(refreshTooltip.value).toBe('Refreshes on next billing cycle')
      expect(mockT).toHaveBeenCalledWith('subscription.nextBillingCycle')
    })
  })

  describe('handleAddApiCredits', () => {
    it('should call showTopUpCreditsDialog', () => {
      const { handleAddApiCredits } = useSubscriptionActions()
      handleAddApiCredits()
      expect(mockShowTopUpCreditsDialog).toHaveBeenCalledOnce()
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

    it('should handle errors gracefully', async () => {
      mockExecute.mockRejectedValueOnce(new Error('Command failed'))
      const { handleMessageSupport, isLoadingSupport } =
        useSubscriptionActions()

      await handleMessageSupport()
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
