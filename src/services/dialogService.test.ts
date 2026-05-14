import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockCanAccessSubscriptionFeatures,
  mockIsFreeTier,
  mockBillingType,
  mockShowDialog
} = vi.hoisted(() => ({
  mockCanAccessSubscriptionFeatures: { value: true },
  mockIsFreeTier: { value: false },
  mockBillingType: { value: 'legacy' as 'legacy' | 'workspace' },
  mockShowDialog: vi.fn()
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

describe('dialogService', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockCanAccessSubscriptionFeatures.value = true
    mockIsFreeTier.value = false
    mockBillingType.value = 'legacy'
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
  })
})
