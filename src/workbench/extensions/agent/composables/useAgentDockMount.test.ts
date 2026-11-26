import type { GlobalSetting } from '@comfyorg/ingest-types'
import { fromPartial } from '@total-typescript/shoehorn'
import { computed, nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import type {
  BillingStatusReadOptions,
  SubscriptionInfo
} from '@/platform/billing/composables/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import type { AuthUserInfo } from '@comfyorg/api-client/authTypes'
import { useAgentConsentStore } from '@/workbench/extensions/agent/stores/agent/agentConsentStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'
import { reportError } from '@comfyorg/telemetry/reportError'

import { useAgentDockMount } from './useAgentDockMount'

vi.mock(import('firebase/auth'))
vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@comfyorg/telemetry/reportError'))
vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/platform/billing/composables/useBillingContext'))

const accountApi = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  header: vi.fn()
}))
vi.mock(import('@/platform/settings/globalSettingsApi'), () => ({
  getGlobalSetting: accountApi.get,
  setGlobalSetting: accountApi.set
}))
vi.mock(
  import('@/workbench/extensions/agent/services/agent/agentAuth'),
  () => ({ agentSettingsAuthHeader: accountApi.header })
)

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

const storedConsent: GlobalSetting = {
  key: 'Comfy.AgentPanel.ConsentAccepted',
  value: true,
  updated_at: '2026-09-09T00:00:00Z'
}

describe('useAgentDockMount', () => {
  beforeEach(() => {
    localStorage.clear()
    Object.assign(useTeamWorkspaceStore(), {
      activeWorkspaceId: 'workspace-a',
      workspaceTransitionGeneration: 0
    })
    useTeamWorkspaceStore().isSwitching = false
    vi.mocked(useTeamWorkspaceStore().initialize).mockResolvedValue(undefined)
    accountApi.header.mockResolvedValue({ Authorization: 'Bearer token' })
    accountApi.get.mockResolvedValue(undefined)
    accountApi.set.mockResolvedValue(storedConsent)
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
    await nextTick()
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
    let completedRefreshes = 0
    const fetchStatusFresh = vi.fn(async () => {
      await Promise.resolve()
      completedRefreshes += 1
      return true
    })
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
    await vi.waitFor(() => expect(completedRefreshes).toBe(1))
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
    let completedRefreshes = 0
    const fetchStatusFresh = vi.fn(() => {
      return new Promise<boolean>((resolve) => {
        finishRefresh = resolve
      }).finally(() => {
        completedRefreshes += 1
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
    await vi.waitFor(() => expect(completedRefreshes).toBe(1))
    expect(store.claimCreditTransitionNoticeImpression('account-b:none')).toBe(
      false
    )

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

  it('keeps a scoped balance from an unadopted read out of the baseline', async () => {
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
      type: computed(() => 'workspace'),
      subscription: computed(() =>
        fromPartial<SubscriptionInfo>(subscription.value)
      )
    })
    const store = useAgentPanelStore()

    useAgentDockMount()
    accountId.value = 'account-b'
    await nextTick()
    expect(fetchStatusFresh).toHaveBeenCalledOnce()

    finishRefresh?.(false)
    await vi.runAllTimersAsync()
    subscription.value = { ...subscription.value, agentScopedHasFunds: false }
    await nextTick()

    expect(store.claimCreditTransitionNoticeImpression('account-b:none')).toBe(
      false
    )
  })

  it('keeps an unadopted read out of the baseline when it resolves after the refresh timeout', async () => {
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
      type: computed(() => 'workspace'),
      subscription: computed(() =>
        fromPartial<SubscriptionInfo>(subscription.value)
      )
    })
    const store = useAgentPanelStore()

    useAgentDockMount()
    accountId.value = 'account-b'
    await nextTick()
    expect(fetchStatusFresh).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(15_000)

    finishRefresh?.(false)
    await vi.runAllTimersAsync()
    subscription.value = { ...subscription.value, agentScopedHasFunds: false }
    await nextTick()

    expect(store.claimCreditTransitionNoticeImpression('account-b:none')).toBe(
      false
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
    let completedRefreshes = 0
    const fetchStatusFresh = vi.fn(async () => {
      try {
        if (completedRefreshes === 0) throw new Error('offline')
        return true
      } finally {
        completedRefreshes += 1
      }
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
    accountId.value = 'account-b'
    await nextTick()
    await vi.waitFor(() => expect(fetchStatusFresh).toHaveBeenCalledOnce())
    await vi.waitFor(() => expect(reportError).toHaveBeenCalledOnce())
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
    function configurePersistentConsentHost() {
      useCurrentUser().resolvedUserInfo = computed(() => ({ id: 'account-a' }))
    }

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

    it('refreshes billing from the persistent host after a confirmed Agree', async () => {
      configurePersistentConsentHost()
      let finishSave = (_value: GlobalSetting): void => {}
      accountApi.set.mockImplementationOnce(
        () =>
          new Promise<GlobalSetting>((resolve) => {
            finishSave = resolve
          })
      )
      const { consent, fetchStatus } = mountWithBilling()

      const accepting = consent.accept()
      await vi.waitFor(() => expect(accountApi.set).toHaveBeenCalledOnce())
      expect(fetchStatus).not.toHaveBeenCalled()

      finishSave(storedConsent)
      await expect(accepting).resolves.toBe(true)

      expect(fetchStatus).toHaveBeenCalledOnce()
    })

    it('does not refresh billing when persistent consent loads', async () => {
      configurePersistentConsentHost()
      accountApi.get.mockResolvedValue(storedConsent)
      const { consent, fetchStatus } = mountWithBilling()

      await expect(consent.load()).resolves.toBe(true)

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

    describe('shared with the panel open that acceptance triggers', () => {
      /**
       * `hosts` is load-bearing rather than incidental: in linear mode
       * `GraphCanvas` stays mounted behind `v-show` while `LinearView` mounts
       * too, so two instances of this composable watch the same open.
       */
      function mountWithFreshBilling(hosts = 1) {
        const fetchStatusFresh = vi.fn(async () => true)
        const fetchStatus = vi.fn(
          async (_options?: BillingStatusReadOptions) => {}
        )
        vi.mocked(useBillingContext).mockReturnValue({
          ...billingContext,
          fetchStatus,
          fetchStatusFresh
        })
        for (let host = 0; host < hosts; host += 1) useAgentDockMount()
        // Counted across both entry points, so the assertion is about how many
        // fresh reads happen rather than which call issues them.
        const freshReads = () =>
          fetchStatus.mock.calls.filter(([options]) => options?.fresh === true)
            .length + fetchStatusFresh.mock.calls.length
        return {
          consent: useAgentConsentStore(),
          store: useAgentPanelStore(),
          fetchStatus,
          fetchStatusFresh,
          freshReads
        }
      }

      /** Drains the microtasks a chained refresh is issued on. */
      const settleRefreshes = async () => {
        await nextTick()
        await new Promise((resolve) => setTimeout(resolve, 0))
      }

      it('reads billing once when acceptance opens the panel', async () => {
        const { consent, store, freshReads } = mountWithFreshBilling()

        consent.confirmedAcceptances += 1
        await nextTick()
        store.isOpen = true
        await settleRefreshes()

        expect(freshReads()).toBe(1)
      })

      it('reads billing once when acceptance opens the panel in linear mode', async () => {
        const { consent, store, freshReads } = mountWithFreshBilling(2)

        consent.confirmedAcceptances += 1
        await nextTick()
        store.isOpen = true
        await settleRefreshes()

        expect(freshReads()).toBe(1)
      })

      it('passes the acceptance read the option that detaches an in-flight read', async () => {
        const { consent, fetchStatus } = mountWithFreshBilling()

        consent.confirmedAcceptances += 1
        await settleRefreshes()

        // Without `fresh: true` the read joins a status request that was
        // already in flight before consent was accepted, so it can answer with
        // pre-acceptance funds -- and the open that would have corrected it is
        // now skipped.
        expect(fetchStatus).toHaveBeenCalledWith({ fresh: true })
      })

      it('leaves the open its own read when the acceptance read fails', async () => {
        const { consent, store, fetchStatus, fetchStatusFresh } =
          mountWithFreshBilling()
        fetchStatus.mockRejectedValueOnce(new Error('status read failed'))

        consent.confirmedAcceptances += 1
        await nextTick()
        expect(fetchStatus).toHaveBeenCalledWith({ fresh: true })
        store.isOpen = true

        // The acceptance read never landed, so this open still owes one: before
        // the read was shared, every open issued its own.
        await vi.waitFor(() => expect(fetchStatusFresh).toHaveBeenCalledOnce())
      })

      it('leaves an unrelated later open its own read when acceptance never opened the panel', async () => {
        const now = vi.spyOn(Date, 'now')
        now.mockReturnValue(1_000)
        const { consent, store, fetchStatus, fetchStatusFresh } =
          mountWithFreshBilling()

        // An acceptance whose `onAccept` bails on `canOpen()` refreshes billing
        // and never opens the panel.
        consent.confirmedAcceptances += 1
        await settleRefreshes()
        expect(fetchStatus).toHaveBeenCalledWith({ fresh: true })
        expect(fetchStatusFresh).not.toHaveBeenCalled()

        // Hours later, an open that has nothing to do with that acceptance must
        // not inherit its read.
        now.mockReturnValue(1_000 + 3_600_000)
        store.isOpen = true

        await vi.waitFor(() => expect(fetchStatusFresh).toHaveBeenCalledOnce())
      })

      it('still reads billing on an open that no acceptance triggered', async () => {
        const { consent, store, freshReads } = mountWithFreshBilling()

        consent.confirmedAcceptances += 1
        await nextTick()
        store.isOpen = true
        await settleRefreshes()
        expect(freshReads()).toBe(1)

        store.close('close_button')
        await nextTick()
        store.isOpen = true

        // A reopen read chains after the refresh in flight, so it is issued a
        // microtask later rather than on this tick.
        await vi.waitFor(() => expect(freshReads()).toBe(2))
      })

      it('leaves a later open its own read when acceptance did not open the panel', async () => {
        const { consent, store, freshReads } = mountWithFreshBilling()
        store.isOpen = true
        await settleRefreshes()
        expect(freshReads()).toBe(1)

        consent.confirmedAcceptances += 1
        await settleRefreshes()
        expect(freshReads()).toBe(2)

        store.close('close_button')
        await nextTick()
        store.isOpen = true

        await vi.waitFor(() => expect(freshReads()).toBe(3))
      })

      it('keeps the deferred read when billing routing is not known yet', async () => {
        const fetchStatusFresh = vi.fn(async () => true)
        const fetchStatus = vi.fn(async () => {})
        vi.mocked(useBillingContext).mockReturnValue({
          ...billingContext,
          type: computed(() => 'unknown'),
          fetchStatus,
          fetchStatusFresh
        })
        useAgentDockMount()

        useAgentConsentStore().confirmedAcceptances += 1
        await nextTick()

        // `fetchStatus` owes the fresh read until routing resolves; the keyed
        // rail would drop it.
        expect(fetchStatus).toHaveBeenCalledWith({ fresh: true })
        expect(fetchStatusFresh).not.toHaveBeenCalled()
      })
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
