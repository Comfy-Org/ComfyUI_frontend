import { useDialogService } from '@/services/dialogService'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useCommandStore } from '@/stores/commandStore'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthActions } from '@/composables/auth/useAuthActions'
import { useSubscriptionActions } from '@/platform/cloud/subscription/composables/useSubscriptionActions'
import { useTelemetry } from '@/platform/telemetry'
import { mockBillingContext } from '@/utils/__tests__/mockBillingContext'

const mockExecute = vi.fn<ReturnType<typeof useCommandStore>['execute']>(
  async () => undefined
)
const mockToastAdd = vi.fn()

const { mockReportError } = vi.hoisted(() => ({
  mockReportError: vi.fn()
}))

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: mockReportError
}))

vi.mock(import('@/composables/auth/useAuthActions'))

vi.mock(import('@/composables/billing/useBillingContext'))

vi.mock(import('@/services/dialogService'))

// useTelemetry() returns null in OSS, a dispatcher in cloud — toggle via mockIsCloud.
const mockIsCloud = vi.hoisted(() => ({ value: true }))

vi.mock(import('@/platform/telemetry'))
const telemetryResult = useTelemetry()
if (!telemetryResult) throw new Error('Expected telemetry mock')
const telemetry = vi.mocked(telemetryResult)

// Mock window.open
const mockOpen = vi.fn()
Object.defineProperty(window, 'open', {
  writable: true,
  value: mockOpen
})

beforeEach(() => {
  vi.mocked(useTelemetry).mockImplementation(() =>
    mockIsCloud.value ? telemetry : null
  )
  vi.mocked(useToastStore().add).mockImplementation(mockToastAdd)
  vi.mocked(useCommandStore().execute).mockImplementation(mockExecute)
})

describe('useSubscriptionActions', () => {
  beforeEach(() => {
    mockIsCloud.value = true
  })

  describe('handleAddApiCredits', () => {
    it('should call showTopUpCreditsDialog', () => {
      const { handleAddApiCredits } = useSubscriptionActions()
      handleAddApiCredits()
      expect(useDialogService().showTopUpCreditsDialog).toHaveBeenCalledOnce()
      expect(telemetry.trackAddApiCreditButtonClicked).toHaveBeenCalledWith({
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

      expect(telemetry.trackHelpResourceClicked).toHaveBeenCalledWith({
        resource_type: 'help_feedback',
        is_external: true,
        source: 'subscription'
      })
    })

    it('does not fire telemetry when messaging support in OSS builds', async () => {
      mockIsCloud.value = false
      const { handleMessageSupport } = useSubscriptionActions()

      await handleMessageSupport()

      expect(telemetry.trackHelpResourceClicked).not.toHaveBeenCalled()
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
      const billing = mockBillingContext()
      const { handleRefresh } = useSubscriptionActions()
      await handleRefresh()

      expect(billing.fetchBalance).toHaveBeenCalledOnce()
      expect(billing.fetchStatus).toHaveBeenCalledOnce()
      expect(useAuthActions().fetchBalance).not.toHaveBeenCalled()
    })

    it('swallows refresh failures without surfacing a toast', async () => {
      const billing = mockBillingContext()
      vi.mocked(billing.fetchBalance).mockRejectedValueOnce(
        new Error('Fetch failed')
      )
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
