import { fromPartial } from '@total-typescript/shoehorn'
import { computed, nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import type { AuthUserInfo } from '@/types/authTypes'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import type { SubscriptionInfo } from '@/platform/billing/composables/types'
import { useAgentConsentStore } from '@/workbench/extensions/agent/stores/agent/agentConsentStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { reportError } from '@/platform/telemetry/reportError'

import { useAgentDockMount } from './useAgentDockMount'

vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/platform/telemetry/reportError'))
vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/platform/billing/composables/useBillingContext'))
const billingContext = useBillingContext()
const { loadDockedAgentPanel } = vi.hoisted(() => ({
  loadDockedAgentPanel: vi.fn(() => ({ name: 'DockedAgentPanel' }))
}))
vi.mock<unknown>(
  import('@/workbench/extensions/agent/components/agent/DockedAgentPanel.vue'),
  () => ({ __esModule: true, default: loadDockedAgentPanel() })
)

function getAsyncLoader(component: unknown): () => Promise<unknown> {
  if (
    component === null ||
    typeof component !== 'object' ||
    !('__asyncLoader' in component) ||
    typeof component.__asyncLoader !== 'function'
  ) {
    throw new TypeError('Expected DockedAgentPanel to be an async component')
  }
  return component.__asyncLoader as () => Promise<unknown>
}

describe('useAgentDockMount', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(useBillingContext).mockReturnValue({
      ...billingContext,
      subscription: computed(() =>
        fromPartial<SubscriptionInfo>({
          hasFunds: false,
          agentHasFunds: false
        })
      )
    })
  })

  it('re-arms exhaustion after funds recover while the panel is closed', async () => {
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    const subscription = ref({ hasFunds: false, agentHasFunds: false })
    vi.mocked(useBillingContext).mockReturnValue({
      ...billingContext,
      subscription: computed(() =>
        fromPartial<SubscriptionInfo>(subscription.value)
      )
    })
    const store = useAgentPanelStore()
    store.reportedExhaustionIdentity = 'account-a:workspace-a'

    const { docked } = useAgentDockMount()
    expect(docked.value).toBe(false)

    subscription.value = { hasFunds: false, agentHasFunds: true }
    await nextTick()

    expect(store.reportedExhaustionIdentity).toBeNull()
  })

  it('re-arms the credit-transition notice after scoped funds refill while closed', async () => {
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    const subscription = ref({
      hasFunds: true,
      agentHasFunds: true,
      agentScopedHasFunds: true
    })
    vi.mocked(useBillingContext).mockReturnValue({
      ...billingContext,
      subscription: computed(() =>
        fromPartial<SubscriptionInfo>(subscription.value)
      )
    })
    const store = useAgentPanelStore()

    useAgentDockMount()
    subscription.value = {
      hasFunds: true,
      agentHasFunds: true,
      agentScopedHasFunds: false
    }
    await nextTick()

    expect(store.claimCreditTransitionNoticeImpression('anonymous:none')).toBe(
      true
    )

    subscription.value = {
      hasFunds: true,
      agentHasFunds: true,
      agentScopedHasFunds: true
    }
    await nextTick()
    subscription.value = {
      hasFunds: true,
      agentHasFunds: true,
      agentScopedHasFunds: false
    }
    await nextTick()

    expect(store.claimCreditTransitionNoticeImpression('anonymous:none')).toBe(
      true
    )
  })

  it('observes the scoped balance again after the billing identity changes', async () => {
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    const accountId = ref('account-a')
    useCurrentUser().resolvedUserInfo = computed(() =>
      fromPartial<AuthUserInfo>({ id: accountId.value })
    )
    const subscription = ref({
      hasFunds: true,
      agentHasFunds: true,
      agentScopedHasFunds: true
    })
    vi.mocked(useBillingContext).mockReturnValue({
      ...billingContext,
      subscription: computed(() =>
        fromPartial<SubscriptionInfo>(subscription.value)
      )
    })
    const store = useAgentPanelStore()

    useAgentDockMount()

    accountId.value = 'account-b'
    await nextTick()
    subscription.value = {
      hasFunds: true,
      agentHasFunds: true,
      agentScopedHasFunds: false
    }
    await nextTick()

    expect(store.claimCreditTransitionNoticeImpression('account-b:none')).toBe(
      true
    )
  })

  it('docks only once the gate enables and the panel opens, off cloud too', async () => {
    vi.stubGlobal('__DISTRIBUTION__', 'localhost')
    const store = useAgentPanelStore()

    const { docked, DockedAgentPanel } = useAgentDockMount()

    expect(DockedAgentPanel).not.toBeNull()
    expect(loadDockedAgentPanel).not.toHaveBeenCalled()
    expect(docked.value).toBe(false)
    store.enabled = true
    store.consentAccepted = true
    expect(loadDockedAgentPanel).not.toHaveBeenCalled()
    expect(docked.value).toBe(false)
    store.isOpen = true
    expect(docked.value).toBe(true)
    const resolvedPanel = await getAsyncLoader(DockedAgentPanel)()
    const { default: expectedPanel } =
      await import('@/workbench/extensions/agent/components/agent/DockedAgentPanel.vue')
    expect(resolvedPanel).toBe(expectedPanel)
    expect(loadDockedAgentPanel).toHaveBeenCalledOnce()
    store.close('close_button')
    expect(docked.value).toBe(false)
  })

  describe('billing refresh after consent', () => {
    function mountWithBilling() {
      const fetchStatus = vi.fn(async () => {})
      vi.mocked(useBillingContext).mockReturnValue({
        ...billingContext,
        fetchStatus
      })
      useAgentDockMount()
      return { consent: useAgentConsentStore(), fetchStatus }
    }

    it('refreshes billing when consent is accepted while the panel is closed', async () => {
      const { consent, fetchStatus } = mountWithBilling()
      expect(useAgentPanelStore().isOpen).toBe(false)

      consent.confirmedAcceptances += 1
      await nextTick()

      expect(fetchStatus).toHaveBeenCalledOnce()
      expect(fetchStatus).toHaveBeenCalledWith({ fresh: true })
    })

    it('refreshes billing for an acceptance recorded before any host mounted', async () => {
      useAgentConsentStore().confirmedAcceptances += 1

      const { fetchStatus } = mountWithBilling()

      expect(fetchStatus).toHaveBeenCalledOnce()
    })

    it('does not refresh billing when stored consent loads', async () => {
      const { consent, fetchStatus } = mountWithBilling()

      Object.assign(consent, { accepted: true })
      await nextTick()

      expect(fetchStatus).not.toHaveBeenCalled()
    })

    it('refreshes once per acceptance when both graph and linear hosts are mounted', async () => {
      const { consent, fetchStatus } = mountWithBilling()
      useAgentDockMount()

      consent.confirmedAcceptances += 1
      await nextTick()
      expect(fetchStatus).toHaveBeenCalledOnce()

      consent.confirmedAcceptances += 1
      await nextTick()
      expect(fetchStatus).toHaveBeenCalledTimes(2)
    })

    it('reports a failed refresh without rejecting', async () => {
      const failure = new Error('status read failed')
      const { consent, fetchStatus } = mountWithBilling()
      fetchStatus.mockRejectedValueOnce(failure)

      consent.confirmedAcceptances += 1
      await vi.waitFor(() =>
        expect(reportError).toHaveBeenCalledWith(failure, {
          surface: 'agent',
          errorType: 'error_refreshing_agent_billing_status'
        })
      )
    })
  })
})
