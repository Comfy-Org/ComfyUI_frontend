import { computed, ref } from 'vue'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useSubscriptionDialog } from '@/platform/billing/subscription/composables/useSubscriptionDialog'
import { useTelemetry } from '@comfyorg/telemetry'
import { TelemetryRegistry } from '@comfyorg/telemetry/TelemetryRegistry'
import { DatadogRumTelemetryProvider } from '@/platform/telemetry/providers/cloud/DatadogRumTelemetryProvider'
import { useToast } from '@/components/ui/toast/toastStore'
import { useDialogStore } from '@/stores/dialogStore'
import AddCreditsDialogContent from '@/platform/billing/components/AddCreditsDialogContent.vue'
import TopUpCreditsDialogContentWorkspace from '@/platform/billing/components/TopUpCreditsDialogContentWorkspace.vue'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
/**
 * showTopUpCreditsDialog routes the paired server capabilities to purchase,
 * subscription, or read-only contact-admin UI.
 */
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { usePaymentRecoveryDialog } from '@/platform/billing/composables/usePaymentRecoveryDialog'

vi.mock(import('@/i18n'))
vi.mock(import('@/composables/useFeatureFlags'))

vi.mock(import('@comfyorg/telemetry'))

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
    useBillingCapabilities().topUpDenial = computed(() => 'not_workspace_owner')

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
      denial: 'payment_past_due',
      recovery: 1,
      dialogs: [],
      plans: 0,
      toast: null
    },
    {
      denial: 'not_workspace_owner',
      recovery: 0,
      dialogs: ['insufficient-credits-member'],
      plans: 0,
      toast: null
    },
    { denial: 'free_plan', recovery: 0, dialogs: [], plans: 1, toast: null },
    {
      denial: 'no_subscription',
      recovery: 0,
      dialogs: [],
      plans: 1,
      toast: null
    },
    {
      denial: 'subscription_ended',
      recovery: 0,
      dialogs: [],
      plans: 1,
      toast: null
    },
    {
      denial: 'topup_purchases_paused',
      recovery: 0,
      dialogs: [],
      plans: 0,
      toast: 'credits.topUp.deniedTopupsPaused'
    },
    {
      denial: 'creator_only_provisioning',
      recovery: 0,
      dialogs: [],
      plans: 0,
      toast: 'credits.topUp.deniedCreatorOnly'
    },
    {
      denial: 'tier_not_self_serve',
      recovery: 0,
      dialogs: [],
      plans: 0,
      toast: 'subscription.planUnavailable.salesManaged'
    },
    {
      denial: 'not_a_member',
      recovery: 0,
      dialogs: [],
      plans: 0,
      toast: 'subscription.planUnavailable.notAMember'
    },
    {
      denial: 'subscription_status_unrecognized',
      recovery: 0,
      dialogs: [],
      plans: 0,
      toast: 'subscription.planUnavailable.billingStateUnknown'
    },
    {
      denial: undefined,
      recovery: 0,
      dialogs: [],
      plans: 0,
      toast: 'subscription.planUnavailable.billingStateUnknown'
    }
  ] as const)(
    'routes a denied top-up served as $denial',
    async ({ denial, recovery, dialogs, plans, toast }) => {
      useBillingCapabilities().canTopUp = computed(() => false)
      useBillingCapabilities().topUpDenial = computed(() => denial)

      await useBillingDialogs().showTopUpCreditsDialog({
        isInsufficientCredits: true
      })

      const storeDialogKeys = vi
        .mocked(useDialogStore().showDialog)
        .mock.calls.map(([args]) => args.key)
      expect(mockShowPaymentRecoveryDialog).toHaveBeenCalledTimes(recovery)
      expect(storeDialogKeys).toEqual(dialogs)
      expect(useSubscriptionDialog().show).toHaveBeenCalledTimes(plans)
      if (toast === null) expect(useToast().error).not.toHaveBeenCalled()
      else expect(useToast().error).toHaveBeenCalledExactlyOnceWith(toast)
    }
  )

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

  it.for([
    { flag: true, component: AddCreditsDialogContent },
    { flag: false, component: TopUpCreditsDialogContentWorkspace }
  ])(
    'opens the purchase dialog billing_new_ux_enabled=$flag picks, even while routing is unknown',
    async ({ flag, component }) => {
      useFeatureFlags().flags.billingNewUxEnabled = flag
      useBillingContext().type = computed(() => 'unknown')

      await useBillingDialogs().showTopUpCreditsDialog({
        isInsufficientCredits: true,
        source: 'agent_paywall'
      })

      const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
      expect(args.component).toBe(component)
    }
  )

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
      useBillingContext().type = computed(() => 'workspace')
    })

    it('opens the purchase dialog when the capability endpoint defaults open', async () => {
      await useBillingDialogs().showTopUpCreditsDialog()

      expect(useSubscriptionDialog().show).not.toHaveBeenCalled()
      const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
      expect(args.key).toBe('top-up-credits')
    })
  })
})
