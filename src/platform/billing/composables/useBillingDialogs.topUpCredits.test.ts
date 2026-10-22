import { computed, ref } from 'vue'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useSubscriptionDialog } from '@/platform/billing/subscription/composables/useSubscriptionDialog'
import { useTelemetry } from '@/platform/telemetry'
import { TelemetryRegistry } from '@/platform/telemetry/TelemetryRegistry'
import { DatadogRumTelemetryProvider } from '@/platform/telemetry/providers/cloud/DatadogRumTelemetryProvider'
import { useDialogStore } from '@/stores/dialogStore'
import TopUpCreditsDialogContentWorkspace from '@/platform/billing/components/TopUpCreditsDialogContentWorkspace.vue'
/**
 * showTopUpCreditsDialog routes the paired server capabilities to purchase,
 * subscription, or read-only contact-admin UI.
 */
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { usePaymentRecoveryDialog } from '@/platform/billing/composables/usePaymentRecoveryDialog'

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

vi.mock(import('@/platform/billing/composables/useBillingContext'))

vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))

vi.mock(import('@/platform/billing/composables/usePaymentRecoveryDialog'), {
  spy: true
})

vi.mock(
  import('@/platform/billing/subscription/composables/useSubscriptionDialog')
)

import { useBillingDialogs } from '@/platform/billing/composables/useBillingDialogs'

const mockShowPaymentRecoveryDialog = vi.fn()

describe('showTopUpCreditsDialog', () => {
  beforeEach(() => {
    const billing = useBillingContext()
    billing.type = computed(() => 'workspace')
    vi.mocked(useBillingContext).mockReturnValue(billing)
    vi.mocked(usePaymentRecoveryDialog).mockReturnValue({
      showPaymentRecoveryDialog: mockShowPaymentRecoveryDialog,
      updatePayment: vi.fn(),
      isUpdatingPayment: computed(() => false),
      paymentRecoveryLock: computed(() => null),
      refreshCapabilities: vi.fn(async () => undefined)
    })

    mockIsCloud.value = true
  })

  it('shows the purchase dialog to users who can top up', async () => {
    await useBillingDialogs().showTopUpCreditsDialog({
      isInsufficientCredits: true
    })

    const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
    expect(args.key).toBe('top-up-credits')
    expect(useBillingCapabilities().initialize).not.toHaveBeenCalled()
  })

  it('opens headless', async () => {
    await useBillingDialogs().showTopUpCreditsDialog()
    const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
    expect(args.dialogComponentProps?.headless).toBe(true)
  })

  it('shows the contact-admin notice to team members instead of the purchase dialog', async () => {
    useBillingCapabilities().canTopUp = computed(() => false)

    await useBillingDialogs().showTopUpCreditsDialog({
      isInsufficientCredits: true
    })

    const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
    expect(args.key).toBe('insufficient-credits-member')
    // The member notice draws its own header + close button, so it must open
    // headless or Reka wraps it in duplicate chrome.
    expect(args.dialogComponentProps?.headless).toBe(true)

    const props = args.props
    assert(props && 'onClose' in props && typeof props.onClose === 'function')
    props.onClose()
    expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
      key: 'insufficient-credits-member'
    })
  })

  it.for([
    {
      type: 'workspace',
      canTopUp: false,
      denial: 'payment_past_due',
      opensRecovery: true,
      storeDialogs: []
    },
    {
      type: 'legacy',
      canTopUp: false,
      denial: 'payment_past_due',
      opensRecovery: true,
      storeDialogs: []
    },
    {
      type: 'workspace',
      canTopUp: false,
      denial: 'not_workspace_owner',
      opensRecovery: false,
      storeDialogs: ['insufficient-credits-member']
    },
    {
      type: 'workspace',
      canTopUp: false,
      denial: 'free_plan',
      opensRecovery: false,
      storeDialogs: ['insufficient-credits-member']
    },
    {
      type: 'workspace',
      canTopUp: false,
      denial: undefined,
      opensRecovery: false,
      storeDialogs: ['insufficient-credits-member']
    },
    {
      type: 'legacy',
      canTopUp: false,
      denial: 'subscription_ended',
      opensRecovery: false,
      storeDialogs: []
    },
    {
      type: 'workspace',
      canTopUp: true,
      denial: undefined,
      opensRecovery: false,
      storeDialogs: ['top-up-credits']
    }
  ] as const)(
    'routes a $type top-up denied as $denial (recovery: $opensRecovery, dialogs: $storeDialogs)',
    async ({ type, canTopUp, denial, opensRecovery, storeDialogs }) => {
      useBillingContext().type = computed(() => type)
      useBillingCapabilities().canTopUp = computed(() => canTopUp)
      useBillingCapabilities().topUpDenial = computed(() => denial)

      await useBillingDialogs().showTopUpCreditsDialog({
        isInsufficientCredits: true
      })

      const storeDialogKeys = vi
        .mocked(useDialogStore().showDialog)
        .mock.calls.map(([args]) => args.key)
      expect(mockShowPaymentRecoveryDialog).toHaveBeenCalledTimes(
        opensRecovery ? 1 : 0
      )
      expect(storeDialogKeys).toEqual(storeDialogs)
      expect(useSubscriptionDialog().show).not.toHaveBeenCalled()
    }
  )

  it('uses the server capability on legacy billing', async () => {
    useBillingContext().type = computed(() => 'legacy')

    await useBillingDialogs().showTopUpCreditsDialog()

    const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
    expect(args.key).toBe('top-up-credits')
  })

  it('does not show workspace-admin copy for denied legacy billing', async () => {
    useBillingContext().type = computed(() => 'legacy')
    useBillingCapabilities().canTopUp = computed(() => false)

    await useBillingDialogs().showTopUpCreditsDialog()

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

    await useBillingDialogs().showTopUpCreditsDialog({
      isInsufficientCredits: true
    })

    expect(useBillingCapabilities().initialize).toHaveBeenCalledOnce()
    const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
    expect(args.key).toBe('top-up-credits')
  })

  it('does not route when capabilities stay unresolved after initializing', async () => {
    useBillingCapabilities().canTopUp = computed(() => false)
    useBillingCapabilities().isReady = computed(() => false)

    await useBillingDialogs().showTopUpCreditsDialog()

    expect(useBillingCapabilities().initialize).toHaveBeenCalledOnce()
    expect(useDialogStore().showDialog).not.toHaveBeenCalled()
    expect(useSubscriptionDialog().show).not.toHaveBeenCalled()
  })

  it('does not route a denied top-up to subscription even when self-serve subscribe is allowed', async () => {
    useBillingContext().type = computed(() => 'legacy')
    useBillingCapabilities().canTopUp = computed(() => false)
    useBillingCapabilities().canSubscribeSelfServe = computed(() => true)

    await useBillingDialogs().showTopUpCreditsDialog({
      isInsufficientCredits: true,
      source: 'agent_paywall'
    })

    expect(useSubscriptionDialog().show).not.toHaveBeenCalled()
    expect(useDialogStore().showDialog).not.toHaveBeenCalled()
  })

  it('passes the surface to the workspace rail content', async () => {
    await useBillingDialogs().showTopUpCreditsDialog({
      isInsufficientCredits: true,
      source: 'agent_paywall'
    })

    const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
    expect(args.props).toEqual({
      isInsufficientCredits: true,
      source: 'agent_paywall'
    })
  })

  it('opens the workspace content, never the legacy one, while routing is unknown', async () => {
    useBillingContext().type = computed(() => 'unknown')

    await useBillingDialogs().showTopUpCreditsDialog({
      isInsufficientCredits: true,
      source: 'agent_paywall'
    })

    const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
    expect(args.component).toBe(TopUpCreditsDialogContentWorkspace)
  })

  it('passes the surface to the legacy rail content too', async () => {
    useBillingContext().type = computed(() => 'legacy')

    await useBillingDialogs().showTopUpCreditsDialog({
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
      await useBillingDialogs().showTopUpCreditsDialog(options)

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

      void useBillingDialogs().showTopUpCreditsDialog({ source: 'deep_link' })

      expect(mockRumAddAction).toHaveBeenCalledOnce()
    })

    it('still reports the click when top-up is denied', async () => {
      useBillingCapabilities().canTopUp = computed(() => false)

      await useBillingDialogs().showTopUpCreditsDialog({
        source: 'deep_link'
      })

      expect(mockRumAddAction).toHaveBeenCalledOnce()
    })
  })

  describe('non-cloud distribution', () => {
    beforeEach(() => {
      mockIsCloud.value = false
      useBillingContext().type = computed(() => 'legacy')
    })

    it('opens the purchase dialog when the capability endpoint defaults open', async () => {
      await useBillingDialogs().showTopUpCreditsDialog()

      expect(useSubscriptionDialog().show).not.toHaveBeenCalled()
      const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
      expect(args.key).toBe('top-up-credits')
    })
  })
})
