import { computed, ref } from 'vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import { useDialogStore } from '@/stores/dialogStore'
/**
 * showTopUpCreditsDialog routes the paired server capabilities to purchase,
 * subscription, or read-only contact-admin UI.
 */
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'

vi.mock(import('@/i18n'))

vi.mock(import('@/platform/telemetry'))

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
    expect(
      vi.mocked(useBillingCapabilities().initialize)
    ).not.toHaveBeenCalled()
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
    expect(vi.mocked(useDialogStore().closeDialog)).toHaveBeenCalledWith({
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

    expect(vi.mocked(useDialogStore().showDialog)).not.toHaveBeenCalled()
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

    expect(
      vi.mocked(useBillingCapabilities().initialize)
    ).toHaveBeenCalledOnce()
    const [args] = vi.mocked(useDialogStore().showDialog).mock.calls[0]
    expect(args.key).toBe('top-up-credits')
  })

  it('does not route when capabilities stay unresolved after initializing', async () => {
    useBillingCapabilities().canTopUp = computed(() => false)
    useBillingCapabilities().isReady = computed(() => false)

    await useDialogService().showTopUpCreditsDialog()

    expect(
      vi.mocked(useBillingCapabilities().initialize)
    ).toHaveBeenCalledOnce()
    expect(vi.mocked(useDialogStore().showDialog)).not.toHaveBeenCalled()
    expect(useSubscriptionDialog().show).not.toHaveBeenCalled()
  })

  it('routes self-serve subscribers to the subscription-required flow', async () => {
    useBillingCapabilities().canTopUp = computed(() => false)
    useBillingCapabilities().canSubscribeSelfServe = computed(() => true)

    await useDialogService().showTopUpCreditsDialog()

    expect(useSubscriptionDialog().show).toHaveBeenCalledWith({
      reason: 'top_up_blocked'
    })
    expect(vi.mocked(useDialogStore().showDialog)).not.toHaveBeenCalled()
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
