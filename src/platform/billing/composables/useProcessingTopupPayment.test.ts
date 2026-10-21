import type { HostedTopupCheckout } from '@comfyorg/ingest-types'
import { getActivePinia } from 'pinia'
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import type { BalanceInfo, SubscriptionInfo } from '@/platform/billing/composables/types'
import { useBillingRouting } from '@/platform/billing/composables/useBillingRouting'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import enMessages from '@/locales/en/main.json'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import CurrentUserPopoverWorkspace from '@/platform/workspace/components/CurrentUserPopoverWorkspace.vue'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

const state = vi.hoisted(() => ({ isCloud: true }))

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/platform/billing/composables/useBillingContext'))
vi.mock(import('@/platform/billing/composables/useBillingRouting'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))
vi.mock(import('@/platform/workspace/composables/useWorkspaceUI'))
vi.mock(
  import('@/platform/cloud/subscription/composables/useSubscriptionDialog')
)
vi.mock(import('@/platform/settings/composables/useSettingsDialog'))
vi.mock(import('@/platform/billing/composables/useBillingDialogs'))
vi.mock(import('@/platform/workspace/composables/useWorkspaceDialogs'))
vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return state.isCloud
  }
}))
vi.mock(import('@/config/billingWeb'), () => ({
  getBillingWebUrl: () => new URL('http://localhost:5174')
}))
vi.mock(import('@/config/comfyApi'), () => ({
  getComfyCloudBaseUrl: () => 'https://testcloud.comfy.org'
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const PROCESSING_LINE = "Payment processing. You don't need to pay again."

function serveCheckout(checkoutState: HostedTopupCheckout['state']) {
  vi.spyOn(workspaceApi, 'listTopupCheckouts').mockResolvedValue({
    checkouts: [
      {
        amount_cents: 2500,
        created_at: '2026-10-20T00:00:00Z',
        session_id: 'cs_bank'
      }
    ],
    next_cursor: null
  })
  vi.spyOn(workspaceApi, 'getTopupCheckout').mockResolvedValue({
    amount_cents: 2500,
    payment_amount_cents: 2500,
    session_id: 'cs_bank',
    state: checkoutState
  })
}

function renderPopover() {
  useTeamWorkspaceStore().initState = 'ready'
  Object.assign(useTeamWorkspaceStore(), {
    workspaceName: 'Personal Workspace',
    isInPersonalWorkspace: true
  })
  return render(CurrentUserPopoverWorkspace, {
    global: {
      plugins: [getActivePinia()!, i18n],
      stubs: {
        WorkspaceSwitcherPopover: defineComponent({ template: '<div />' }),
        SubscribeButton: defineComponent({ template: '<button />' }),
        WorkspaceProfilePic: true,
        DeploymentSwitcher: defineComponent({ template: '<div />' })
      }
    }
  })
}

describe('credits flyout payment processing', () => {
  beforeEach(() => {
    state.isCloud = true
    useCurrentUser().userDisplayName = computed(() => 'Liz')
    useCurrentUser().userEmail = computed(() => 'liz@example.com')
    useCurrentUser().userPhotoUrl = computed(() => null)
    useBillingCapabilities().canTopUp = computed(() => true)
    vi.mocked(useFeatureFlags().flags).hostedBillingDestination = 'stripe'
    const billingContext = useBillingContext()
    billingContext.billingStatus = computed(() => 'paid')
    billingContext.canAccessSubscriptionFeatures = computed(() => true)
    billingContext.subscription = computed(
      () =>
        ({
          isActive: true,
          tier: null,
          duration: null,
          isCancelled: false,
          planSlug: 'pro-monthly',
          scheduledChange: null,
          renewalDate: null,
          endDate: null,
          hasFunds: true,
          agentHasFunds: true
        }) satisfies SubscriptionInfo
    )
    billingContext.balance = computed(
      () => ({ amountMicros: 100, currency: 'USD' }) satisfies BalanceInfo
    )
    billingContext.isLoading = ref(false)
    vi.mocked(useBillingContext).mockReturnValue(billingContext)
    const workspaceUI = vi.mocked(useWorkspaceUI())
    workspaceUI.permissions = computed(() => ({
      canViewOtherMembers: false,
      canViewPendingInvites: false,
      canManageSubscription: false,
      canManageSubscriptionLifecycle: false,
      canDowngradeToPersonal: false
    }))
    workspaceUI.canReactivatePlan = computed(() => false)
    workspaceUI.canOpenPricingSurface = computed(() => false)
    vi.mocked(useBillingRouting()).shouldUseWorkspaceBilling = computed(
      () => true
    )
  })

  it('does not read checkouts while unified billing settings are off', () => {
    const list = vi.spyOn(workspaceApi, 'listTopupCheckouts')
    renderPopover()

    expect(screen.getByTestId('add-credits-button')).toBeInTheDocument()
    expect(screen.queryByText(PROCESSING_LINE)).not.toBeInTheDocument()
    expect(list).not.toHaveBeenCalled()
  })

  it('shows the processing line from the checkout state', async () => {
    vi.mocked(useFeatureFlags().flags).unifiedBillingSettingsEnabled = true
    serveCheckout('payment_processing')
    renderPopover()

    expect(await screen.findByText(PROCESSING_LINE)).toBeInTheDocument()
    expect(workspaceApi.getTopupCheckout).toHaveBeenCalledWith('cs_bank')
  })

  it('leaves the line out when the checkout is still open', async () => {
    vi.mocked(useFeatureFlags().flags).unifiedBillingSettingsEnabled = true
    serveCheckout('open')
    renderPopover()

    await waitFor(() =>
      expect(workspaceApi.getTopupCheckout).toHaveBeenCalledWith('cs_bank')
    )
    expect(screen.queryByText(PROCESSING_LINE)).not.toBeInTheDocument()
  })
})
