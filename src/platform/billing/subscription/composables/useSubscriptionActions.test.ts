import { useToast } from '@/components/ui/toast/toastStore'
import { useBillingDialogs } from '@/platform/billing/composables/useBillingDialogs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { provideCurrentUser } from '@/platform/auth/currentUserAccess'

import { useSubscriptionActions } from '@/platform/billing/subscription/composables/useSubscriptionActions'
import { useTelemetry } from '@comfyorg/telemetry'
import { mockBillingContext } from '@/platform/billing/__tests__/mockBillingContext'

const { mockReportError } = vi.hoisted(() => ({
  mockReportError: vi.fn()
}))

vi.mock(import('@comfyorg/telemetry/reportError'), () => ({
  reportError: mockReportError
}))

vi.mock(import('@/composables/auth/useAuthActions'))

vi.mock(import('@/composables/auth/useCurrentUser'))

beforeEach(() => {
  provideCurrentUser(useCurrentUser)
})

vi.mock(import('@/platform/billing/composables/useBillingContext'))

vi.mock(import('@/platform/billing/composables/useBillingDialogs'))

// useTelemetry() returns null in OSS, a dispatcher in cloud — toggle via mockIsCloud.
const mockIsCloud = vi.hoisted(() => ({ value: true }))

vi.mock(import('@comfyorg/telemetry'))

// Mock window.open
const mockOpen = vi.fn()
Object.defineProperty(window, 'open', {
  writable: true,
  value: mockOpen
})

beforeEach(() => {
  const telemetry = useTelemetry()
  if (!telemetry) throw new Error('Expected telemetry mock')
  vi.mocked(useTelemetry).mockImplementation(() =>
    mockIsCloud.value ? telemetry : null
  )
})

describe('useSubscriptionActions', () => {
  beforeEach(() => {
    mockIsCloud.value = true
  })

  describe('handleAddApiCredits', () => {
    it('should call showTopUpCreditsDialog', () => {
      const { handleAddApiCredits } = useSubscriptionActions()
      handleAddApiCredits()
      expect(
        useBillingDialogs().showTopUpCreditsDialog
      ).toHaveBeenCalledExactlyOnceWith({ source: 'settings_billing_panel' })
      expect(
        useTelemetry()?.trackAddApiCreditButtonClicked
      ).toHaveBeenCalledWith({ source: 'settings_billing_panel' })
    })
  })

  describe('handleMessageSupport', () => {
    it('opens the billing support form and manages loading state', async () => {
      const { handleMessageSupport, isLoadingSupport } =
        useSubscriptionActions()

      expect(isLoadingSupport.value).toBe(false)

      const promise = handleMessageSupport()
      expect(isLoadingSupport.value).toBe(true)

      await promise
      expect(mockOpen).toHaveBeenCalledExactlyOnceWith(
        'https://comfysupport.portal.usepylon.com/forms/billing-refund-issue',
        '_blank',
        'noopener,noreferrer'
      )
      expect(isLoadingSupport.value).toBe(false)
    })

    it('tracks help-resource telemetry when messaging support in cloud', async () => {
      const { handleMessageSupport } = useSubscriptionActions()

      await handleMessageSupport()

      expect(useTelemetry()?.trackHelpResourceClicked).toHaveBeenCalledWith({
        resource_type: 'help_feedback',
        is_external: true,
        source: 'subscription'
      })
    })

    it('does not fire telemetry when messaging support in OSS builds', async () => {
      const telemetry = useTelemetry()
      if (!telemetry) throw new Error('Expected telemetry mock')
      mockIsCloud.value = false
      const { handleMessageSupport } = useSubscriptionActions()

      await handleMessageSupport()

      expect(telemetry.trackHelpResourceClicked).not.toHaveBeenCalled()
    })

    it('tells the user when contacting support fails, and stops loading', async () => {
      mockOpen.mockImplementationOnce(() => {
        throw new Error('Popup blocked')
      })
      const { handleMessageSupport, isLoadingSupport } =
        useSubscriptionActions()

      await handleMessageSupport()

      expect(isLoadingSupport.value).toBe(false)
      expect(useToast().toasts).toEqual([
        expect.objectContaining({
          description: 'Popup blocked',
          kind: 'error'
        })
      ])
    })

    it('reports a failed support request so it is visible without the user', async () => {
      const failure = new Error('Popup blocked')
      mockOpen.mockImplementationOnce(() => {
        throw failure
      })
      const { handleMessageSupport } = useSubscriptionActions()

      await handleMessageSupport()

      expect(mockReportError).toHaveBeenCalledWith(failure, {
        surface: 'billing',
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
    })

    it('swallows refresh failures without surfacing a toast', async () => {
      const billing = mockBillingContext()
      vi.mocked(billing.fetchBalance).mockRejectedValueOnce(
        new Error('Fetch failed')
      )
      const { handleRefresh } = useSubscriptionActions()

      await expect(handleRefresh()).resolves.toBeUndefined()
      expect(useToast().toasts).toEqual([])
    })
  })

  describe('handleLearnMoreClick', () => {
    it('should open learn more URL', () => {
      const { handleLearnMoreClick } = useSubscriptionActions()
      handleLearnMoreClick()

      expect(mockOpen).toHaveBeenCalledWith(
        'https://docs.comfy.org/get_started/cloud?utm_source=comfyui_local&utm_medium=product&utm_campaign=subscription_learn_more',
        '_blank'
      )
    })
  })
})
