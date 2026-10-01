import { computed, ref } from 'vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import { useTelemetry } from '@/platform/telemetry'
import { TelemetryRegistry } from '@/platform/telemetry/TelemetryRegistry'
import { DatadogRumTelemetryProvider } from '@/platform/telemetry/providers/cloud/DatadogRumTelemetryProvider'
import { useDialogStore } from '@/stores/dialogStore'
/**
 * showTopUpCreditsDialog routes the paired server capabilities to purchase,
 * subscription, or read-only contact-admin UI.
 */
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'

vi.mock(import('@/i18n'))

vi.mock(import('@/platform/telemetry'))

const mockRumAddAction = vi.hoisted(() => vi.fn())
vi.mock<unknown>(import('@datadog/browser-rum'), () => ({
  datadogRum: { addAction: mockRumAddAction }
}))

vi.mock(import('@/composables/auth/useCurrentUser'))

const mockIsCloud = vi.hoisted(() => ({ value: true }))
vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

vi.mock(import('@/composables/billing/useBillingContext'))

vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))

vi.mock(
  import('@/platform/cloud/subscription/composables/useSubscriptionDialog')
)

import { useDialogService } from '@/services/dialogService'

describe('showTopUpCreditsDialog', () => {
  beforeEach(() => {
    const billing = useBillingContext()
    billing.type = computed(() => 'workspace')
    vi.mocked(useBillingContext).mockReturnValue(billing)

    mockIsCloud.value = true
  })

  it('shows the purchase dialog to users who can top up', async () => {
    await useDialogService().showTopUpCreditsDialog({
      isInsufficientCredits: true
    })

    const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
    expect(args.key).toBe('top-up-credits')
    expect(useBillingCapabilities().initialize).not.toHaveBeenCalled()
  })

  it('shows the contact-admin notice to team members instead of the purchase dialog', async () => {
    useBillingCapabilities().canTopUp = computed(() => false)

    await useDialogService().showTopUpCreditsDialog({
      isInsufficientCredits: true
    })

    const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
    expect(args.key).toBe('insufficient-credits-member')
    // The member notice draws its own header + close button, so it must open
    // headless or Reka wraps it in duplicate chrome.
    expect(args.dialogComponentProps?.headless).toBe(true)
    expect(args.dialogComponentProps?.renderer).toBe('reka')

    const props = args.props
    assert(props && 'onClose' in props && typeof props.onClose === 'function')
    props.onClose()
    expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
      key: 'insufficient-credits-member'
    })
  })

  it('uses the server capability on legacy billing', async () => {
    useBillingContext().type = computed(() => 'legacy')

    await useDialogService().showTopUpCreditsDialog()

    const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
    expect(args.key).toBe('top-up-credits')
  })

  it('does not show workspace-admin copy for denied legacy billing', async () => {
    useBillingContext().type = computed(() => 'legacy')
    useBillingCapabilities().canTopUp = computed(() => false)

    await useDialogService().showTopUpCreditsDialog()

    expect(useDialogStore().showDialog).not.toHaveBeenCalled()
    expect(useSubscriptionDialog().show).not.toHaveBeenCalled()
  })

  it('awaits an in-flight capability read instead of dropping the request', async () => {
    const canTopUp = ref(false)
    const isReady = ref(false)
    useBillingCapabilities().canTopUp = computed(() => canTopUp.value)
    useBillingCapabilities().isReady = computed(() => isReady.value)

    vi.mocked(useBillingCapabilities().initialize).mockImplementation(() => {
      canTopUp.value = true
      isReady.value = true
      return Promise.resolve()
    })

    await useDialogService().showTopUpCreditsDialog({
      isInsufficientCredits: true
    })

    expect(useBillingCapabilities().initialize).toHaveBeenCalledOnce()
    const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
    expect(args.key).toBe('top-up-credits')
  })

  it('does not route when capabilities stay unresolved after initializing', async () => {
    useBillingCapabilities().canTopUp = computed(() => false)
    useBillingCapabilities().isReady = computed(() => false)

    await useDialogService().showTopUpCreditsDialog()

    expect(useBillingCapabilities().initialize).toHaveBeenCalledOnce()
    expect(useDialogStore().showDialog).not.toHaveBeenCalled()
    expect(useSubscriptionDialog().show).not.toHaveBeenCalled()
  })

  it('routes self-serve subscribers to the subscription-required flow', async () => {
    useBillingCapabilities().canTopUp = computed(() => false)
    useBillingCapabilities().canSubscribeSelfServe = computed(() => true)

    await useDialogService().showTopUpCreditsDialog()

    expect(useSubscriptionDialog().show).toHaveBeenCalledWith({
      reason: 'top_up_blocked'
    })
    expect(useDialogStore().showDialog).not.toHaveBeenCalled()
  })

  it('keeps the insufficient-credits copy and still attributes the surface', async () => {
    useBillingCapabilities().canTopUp = computed(() => false)
    useBillingCapabilities().canSubscribeSelfServe = computed(() => true)

    await useDialogService().showTopUpCreditsDialog({
      isInsufficientCredits: true,
      source: 'agent_paywall'
    })

    expect(useSubscriptionDialog().show).toHaveBeenCalledWith({
      reason: 'out_of_credits',
      paymentIntentSource: 'agent_paywall'
    })
  })

  it('attributes the surface on the blocked path, which has no copy branch', async () => {
    useBillingCapabilities().canTopUp = computed(() => false)
    useBillingCapabilities().canSubscribeSelfServe = computed(() => true)

    await useDialogService().showTopUpCreditsDialog({
      source: 'agent_paywall'
    })

    expect(useSubscriptionDialog().show).toHaveBeenCalledWith({
      reason: 'agent_paywall',
      paymentIntentSource: 'agent_paywall'
    })
  })

  it('passes the surface to the workspace rail content', async () => {
    await useDialogService().showTopUpCreditsDialog({
      isInsufficientCredits: true,
      source: 'agent_paywall'
    })

    const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
    expect(args.props).toEqual({
      isInsufficientCredits: true,
      source: 'agent_paywall'
    })
  })

  it('passes the surface to the legacy rail content too', async () => {
    useBillingContext().type = computed(() => 'legacy')

    await useDialogService().showTopUpCreditsDialog({
      isInsufficientCredits: true,
      source: 'agent_paywall'
    })

    const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
    expect(args.props).toEqual({
      isInsufficientCredits: true,
      source: 'agent_paywall'
    })
  })

  describe('add-credits entries reported to Datadog', () => {
    beforeEach(() => {
      const registry = new TelemetryRegistry()
      registry.registerProvider(new DatadogRumTelemetryProvider())
      vi.mocked(useTelemetry).mockReturnValue(registry)
    })

    it.for([
      {
        name: 'a deep link',
        options: { source: 'deep_link' },
        reported: { payment_intent_source: 'deep_link' }
      },
      {
        name: 'the agent paywall',
        options: { isInsufficientCredits: true, source: 'agent_paywall' },
        reported: { payment_intent_source: 'agent_paywall' }
      },
      {
        name: 'a credits precondition that names no surface',
        options: { isInsufficientCredits: true },
        reported: { payment_intent_source: 'out_of_credits' }
      },
      {
        name: 'an entry that names no surface',
        options: undefined,
        reported: {}
      }
    ] as const)('reports $name once', async ({ options, reported }) => {
      await useDialogService().showTopUpCreditsDialog(options)

      expect(mockRumAddAction).toHaveBeenCalledExactlyOnceWith(
        'billing.entry.add_credits_clicked',
        {
          operation: 'entry',
          stage: 'add_credits_clicked',
          outcome: 'pending',
          billing_surface: 'cloud_app',
          ...reported
        }
      )
    })

    it('reports the click before the capability read settles', () => {
      useBillingCapabilities().isReady = computed(() => false)

      void useDialogService().showTopUpCreditsDialog({ source: 'deep_link' })

      expect(mockRumAddAction).toHaveBeenCalledOnce()
    })

    it.for([
      {
        name: 'a self-serve subscriber who is sent to the pricing table',
        canTopUp: false,
        canSubscribeSelfServe: true
      },
      {
        name: 'a team member who cannot buy credits',
        canTopUp: false,
        canSubscribeSelfServe: false
      }
    ])(
      'still reports the click of $name',
      async ({ canTopUp, canSubscribeSelfServe }) => {
        useBillingCapabilities().canTopUp = computed(() => canTopUp)
        useBillingCapabilities().canSubscribeSelfServe = computed(
          () => canSubscribeSelfServe
        )

        await useDialogService().showTopUpCreditsDialog({ source: 'deep_link' })

        expect(mockRumAddAction).toHaveBeenCalledOnce()
      }
    )
  })

  describe('non-cloud distribution', () => {
    beforeEach(() => {
      mockIsCloud.value = false
      useBillingContext().type = computed(() => 'legacy')
    })

    it('opens the purchase dialog when the capability endpoint defaults open', async () => {
      await useDialogService().showTopUpCreditsDialog()

      expect(useSubscriptionDialog().show).not.toHaveBeenCalled()
      const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
      expect(args.key).toBe('top-up-credits')
    })
  })
})
