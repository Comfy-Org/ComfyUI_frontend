import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockCanAccessSubscriptionFeatures,
  mockIsFreeTier,
  mockBillingType,
  mockShowDialog,
  mockSubscriptionDialogShow
} = vi.hoisted(() => ({
  mockCanAccessSubscriptionFeatures: { value: true },
  mockIsFreeTier: { value: false },
  mockBillingType: { value: 'legacy' as 'legacy' | 'workspace' },
  mockShowDialog: vi.fn(),
  mockSubscriptionDialogShow: vi.fn()
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    canAccessSubscriptionFeatures: mockCanAccessSubscriptionFeatures,
    isFreeTier: mockIsFreeTier,
    type: mockBillingType
  })
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({
    showDialog: mockShowDialog,
    closeDialog: vi.fn()
  })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackEvent: vi.fn()
  })
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: true
}))

vi.mock('@/platform/cloud/subscription/composables/useSubscription', () => ({
  useSubscription: () => ({
    isFreeTier: { value: false }
  })
}))

vi.mock(
  '@/platform/cloud/subscription/composables/useSubscriptionDialog',
  () => ({
    useSubscriptionDialog: () => ({
      showPricingTable: vi.fn(),
      show: mockSubscriptionDialogShow
    })
  })
)

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    isInPersonalWorkspace: { value: true }
  })
}))

describe('dialogService', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockCanAccessSubscriptionFeatures.value = true
    mockIsFreeTier.value = false
    mockBillingType.value = 'legacy'
    // Set up window.__CONFIG__ for subscription_required check
    ;(
      globalThis as unknown as {
        __CONFIG__: { subscription_required: boolean }
      }
    ).__CONFIG__ = {
      subscription_required: true
    }
  })

  describe('showTopUpCreditsDialog', () => {
    it('shows top up dialog for legacy billing when canAccessSubscriptionFeatures is true', async () => {
      mockCanAccessSubscriptionFeatures.value = true
      mockIsFreeTier.value = false
      mockBillingType.value = 'legacy'

      const { useDialogService } = await import('./dialogService')
      const dialogService = useDialogService()

      await dialogService.showTopUpCreditsDialog()

      expect(mockShowDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'top-up-credits'
        })
      )
    })

    it('shows workspace top up dialog when type is workspace', async () => {
      mockCanAccessSubscriptionFeatures.value = true
      mockIsFreeTier.value = false
      mockBillingType.value = 'workspace'

      const { useDialogService } = await import('./dialogService')
      const dialogService = useDialogService()

      await dialogService.showTopUpCreditsDialog()

      expect(mockShowDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'top-up-credits'
        })
      )
    })

    it('passes options to dialog when canAccessSubscriptionFeatures', async () => {
      mockCanAccessSubscriptionFeatures.value = true
      mockIsFreeTier.value = false

      const { useDialogService } = await import('./dialogService')
      const dialogService = useDialogService()

      await dialogService.showTopUpCreditsDialog({
        isInsufficientCredits: true
      })

      expect(mockShowDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'top-up-credits',
          props: { isInsufficientCredits: true }
        })
      )
    })

    it('shows subscription dialog when canAccessSubscriptionFeatures is false', async () => {
      mockCanAccessSubscriptionFeatures.value = false
      mockIsFreeTier.value = false

      const { useDialogService } = await import('./dialogService')
      const dialogService = useDialogService()

      await dialogService.showTopUpCreditsDialog()

      expect(mockSubscriptionDialogShow).toHaveBeenCalled()
      expect(mockShowDialog).not.toHaveBeenCalledWith(
        expect.objectContaining({ key: 'top-up-credits' })
      )
    })

    it('shows subscription dialog when isFreeTier is true', async () => {
      mockCanAccessSubscriptionFeatures.value = true
      mockIsFreeTier.value = true

      const { useDialogService } = await import('./dialogService')
      const dialogService = useDialogService()

      await dialogService.showTopUpCreditsDialog()

      expect(mockSubscriptionDialogShow).toHaveBeenCalled()
      expect(mockShowDialog).not.toHaveBeenCalledWith(
        expect.objectContaining({ key: 'top-up-credits' })
      )
    })

    it('passes out_of_credits reason to subscription dialog when isInsufficientCredits', async () => {
      mockCanAccessSubscriptionFeatures.value = false
      mockIsFreeTier.value = false

      const { useDialogService } = await import('./dialogService')
      const dialogService = useDialogService()

      await dialogService.showTopUpCreditsDialog({
        isInsufficientCredits: true
      })

      expect(mockSubscriptionDialogShow).toHaveBeenCalledWith({
        reason: 'out_of_credits'
      })
    })
  })
})
