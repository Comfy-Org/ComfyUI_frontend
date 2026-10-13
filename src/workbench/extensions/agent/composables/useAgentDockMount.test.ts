import { fromPartial } from '@total-typescript/shoehorn'
import { computed, nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import type { AuthUserInfo } from '@/types/authTypes'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import type { SubscriptionInfo } from '@/composables/billing/types'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { useAgentDockMount } from './useAgentDockMount'

vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/composables/billing/useBillingContext'))
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

  it('waits for a fresh scoped balance after the billing identity changes', async () => {
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
    let finishRefresh: ((adopted: boolean) => void) | undefined
    const fetchStatusFresh = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finishRefresh = resolve
        })
    )
    vi.mocked(useBillingContext).mockReturnValue({
      ...billingContext,
      fetchStatusFresh,
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

    expect(fetchStatusFresh).toHaveBeenCalledOnce()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(store.claimCreditTransitionNoticeImpression('account-b:none')).toBe(
      false
    )

    finishRefresh?.(true)
    await vi.waitFor(() => {
      expect(store.creditTransitionRefresh).toBeNull()
    })
    expect(store.claimCreditTransitionNoticeImpression('account-b:none')).toBe(
      false
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

    expect(store.claimCreditTransitionNoticeImpression('account-b:none')).toBe(
      true
    )
  })

  it('deduplicates refreshes across dock hosts and refreshes on every reopen', async () => {
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    const fetchStatusFresh = vi.fn().mockResolvedValue(true)
    vi.mocked(useBillingContext).mockReturnValue({
      ...billingContext,
      fetchStatusFresh,
      type: computed(() => 'workspace')
    })
    const store = useAgentPanelStore()

    useAgentDockMount()
    useAgentDockMount()
    store.isOpen = true
    await nextTick()

    expect(fetchStatusFresh).toHaveBeenCalledOnce()

    store.isOpen = false
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))
    store.isOpen = true
    await nextTick()

    expect(fetchStatusFresh).toHaveBeenCalledTimes(2)
  })

  it('queues one fresh read when reopened during an in-flight read', async () => {
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    let finishFirst: ((adopted: boolean) => void) | undefined
    const fetchStatusFresh = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve) => {
            finishFirst = resolve
          })
      )
      .mockResolvedValue(true)
    vi.mocked(useBillingContext).mockReturnValue({
      ...billingContext,
      fetchStatusFresh,
      type: computed(() => 'workspace')
    })
    const store = useAgentPanelStore()

    useAgentDockMount()
    useAgentDockMount()
    store.isOpen = true
    await nextTick()
    expect(fetchStatusFresh).toHaveBeenCalledOnce()

    store.isOpen = false
    await nextTick()
    store.isOpen = true
    await nextTick()
    expect(fetchStatusFresh).toHaveBeenCalledOnce()

    finishFirst?.(true)
    await vi.waitFor(() => expect(fetchStatusFresh).toHaveBeenCalledTimes(2))
  })

  it('waits for the winning billing read across concurrent dock hosts', async () => {
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
    let finishRefresh: ((adopted: boolean) => void) | undefined
    const fetchStatusFresh = vi.fn(() => {
      return new Promise<boolean>((resolve) => {
        finishRefresh = resolve
      })
    })
    vi.mocked(useBillingContext).mockReturnValue({
      ...billingContext,
      fetchStatusFresh,
      type: computed(() => 'workspace'),
      subscription: computed(() =>
        fromPartial<SubscriptionInfo>(subscription.value)
      )
    })
    const store = useAgentPanelStore()

    useAgentDockMount()
    useAgentDockMount()
    accountId.value = 'account-b'
    await nextTick()

    expect(fetchStatusFresh).toHaveBeenCalledOnce()
    subscription.value = { ...subscription.value, agentScopedHasFunds: false }
    finishRefresh?.(false)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(store.claimCreditTransitionNoticeImpression('account-b:none')).toBe(
      false
    )

    // A later reopen retries the stale read and adopts the winning snapshot.
    fetchStatusFresh.mockResolvedValueOnce(true)
    store.isOpen = true
    await vi.waitFor(() => {
      expect(fetchStatusFresh).toHaveBeenCalledTimes(2)
      expect(store.creditTransitionRefresh).toBeNull()
    })
    expect(store.creditTransitionRefresh).toBeNull()
    expect(store.claimCreditTransitionNoticeImpression('account-b:none')).toBe(
      false
    )

    subscription.value = { ...subscription.value, agentScopedHasFunds: true }
    await nextTick()
    subscription.value = { ...subscription.value, agentScopedHasFunds: false }
    await nextTick()
    expect(store.claimCreditTransitionNoticeImpression('account-b:none')).toBe(
      true
    )
  })

  it('seeds the new identity after a rejected refresh', async () => {
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    const accountId = ref('account-a')
    useCurrentUser().resolvedUserInfo = computed(() =>
      fromPartial<AuthUserInfo>({ id: accountId.value })
    )
    const subscription = ref({
      hasFunds: true,
      agentHasFunds: true,
      agentScopedHasFunds: false
    })
    const fetchStatusFresh = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(true)
    vi.mocked(useBillingContext).mockReturnValue({
      ...billingContext,
      fetchStatusFresh,
      type: computed(() => 'workspace'),
      subscription: computed(() =>
        fromPartial<SubscriptionInfo>(subscription.value)
      )
    })
    const store = useAgentPanelStore()

    useAgentDockMount()
    accountId.value = 'account-b'
    await nextTick()
    await vi.waitFor(() => expect(fetchStatusFresh).toHaveBeenCalledOnce())
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(store.claimCreditTransitionNoticeImpression('account-b:none')).toBe(
      false
    )

    store.isOpen = true
    await vi.waitFor(() => {
      expect(fetchStatusFresh).toHaveBeenCalledTimes(2)
      expect(store.creditTransitionRefresh).toBeNull()
    })

    subscription.value = { ...subscription.value, agentScopedHasFunds: true }
    await nextTick()
    subscription.value = { ...subscription.value, agentScopedHasFunds: false }
    await nextTick()
    expect(store.claimCreditTransitionNoticeImpression('account-b:none')).toBe(
      true
    )
  })

  it('returns an inert mount on non-cloud distributions', () => {
    vi.stubGlobal('__DISTRIBUTION__', 'localhost')

    const { docked, DockedAgentPanel } = useAgentDockMount()

    expect(docked.value).toBe(false)
    expect(DockedAgentPanel).toBeNull()
  })

  it('docks only once the gate enables and the panel opens on cloud', async () => {
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')
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
})
