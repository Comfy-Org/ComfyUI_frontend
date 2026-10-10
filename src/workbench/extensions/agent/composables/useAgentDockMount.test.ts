import { fromPartial } from '@total-typescript/shoehorn'
import { computed, nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import type { AuthUserInfo } from '@/types/authTypes'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import type { SubscriptionInfo } from '@/composables/billing/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import { useAgentDockMount } from './useAgentDockMount'
import { formatBillingIdentity } from './useBillingIdentity'

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

    const identity = store.creditTransitionNotice?.identity
    expect(identity).toBeDefined()
    if (!identity) throw new Error('Expected a billing identity')
    expect(store.claimCreditTransitionNoticeImpression(identity)).toBe(true)

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

    expect(store.claimCreditTransitionNoticeImpression(identity)).toBe(true)
  })

  // Relocated from AgentPanelRoot.test.ts: the identity half of this watcher
  // moved here, so the panel could no longer observe an identity switch.
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

    expect(store.creditTransitionNotice?.identity).toBe(
      formatBillingIdentity('account-b', useTeamWorkspaceStore().workspaceId)
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
