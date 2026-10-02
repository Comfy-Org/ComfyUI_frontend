import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useDialogService } from '@/services/dialogService'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { getActivePinia } from 'pinia'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useBillingRouting } from '@/composables/billing/useBillingRouting'
import type { BalanceInfo, SubscriptionInfo } from '@/composables/billing/types'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import enMessages from '@/locales/en/main.json'
import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import type { BillingStatus } from '@/platform/workspace/api/workspaceApi'

import CurrentUserPopoverWorkspace from './CurrentUserPopoverWorkspace.vue'

/** `null` stands for "no balance read has landed yet" (FE-3164). */
type MockBalance = {
  amountMicros: number
  effectiveBalanceMicros?: number
} | null

const state = vi.hoisted(() => {
  function initialPlanSlug(): string | null {
    return 'pro-monthly'
  }

  function initialBillingWebUrl(): URL | null {
    return new URL('http://localhost:5174')
  }

  function initialBillingStatus(): BillingStatus {
    return 'paid'
  }

  function initialBalance(): MockBalance {
    return { amountMicros: 100 }
  }

  return {
    isCloud: true,
    balance: initialBalance(),
    billingStatus: initialBillingStatus(),
    canAccessSubscriptionFeatures: true,
    isCancelled: false,
    planSlug: initialPlanSlug(),
    canManageSubscription: false,
    canManageSubscriptionLifecycle: false,
    canReactivatePlan: false,
    canOpenPricingSurface: false,
    shouldUseWorkspaceBilling: true,
    billingWebUrl: initialBillingWebUrl()
  }
})

vi.mock(import('@/composables/auth/useCurrentUser'))

vi.mock(import('@/composables/billing/useBillingContext'))

vi.mock(import('@/platform/workspace/composables/useWorkspaceUI'))

vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))

vi.mock(import('@/composables/billing/useBillingRouting'))

vi.mock(
  import('@/platform/cloud/subscription/composables/useSubscriptionDialog')
)

vi.mock(import('@/platform/settings/composables/useSettingsDialog'))

vi.mock(import('@/platform/telemetry/reportError'))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return state.isCloud
  }
}))

vi.mock(import('@/services/dialogService'))

vi.mock(import('@/platform/telemetry'))

vi.mock(import('@/composables/useFeatureFlags'))

vi.mock<unknown>(import('@/config/billingWeb'), () => ({
  getBillingWebUrl: () => state.billingWebUrl
}))

// Pins the billing family the hosted route derives; an unmapped one fails closed to the provider.
vi.mock(import('@/config/comfyApi'), () => ({
  getComfyCloudBaseUrl: () => 'https://testcloud.comfy.org'
}))

const WorkspaceSwitcherPopoverStub = defineComponent({
  emits: ['select', 'create'],
  template: `
    <div>
      <button data-testid="stub-select-workspace" @click="$emit('select')" />
      <button data-testid="stub-create-workspace" @click="$emit('create')" />
    </div>
  `
})

const SubscribeButtonStub = defineComponent({
  props: {
    label: { type: String, required: true }
  },
  template: '<button type="button">{{ label }}</button>'
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderComponent(
  type: 'personal' | 'team' = 'personal',
  accountActionsOnly = false
) {
  useTeamWorkspaceStore().initState = 'ready'
  Object.assign(useTeamWorkspaceStore(), {
    workspaceName: `${type === 'personal' ? 'Personal' : 'Team'} Workspace`
  })
  Object.assign(useTeamWorkspaceStore(), {
    isInPersonalWorkspace: type === 'personal'
  })
  return render(CurrentUserPopoverWorkspace, {
    props: { accountActionsOnly },
    global: {
      plugins: [getActivePinia()!, PrimeVue, i18n],
      directives: {
        tooltip: Tooltip
      },
      stubs: {
        WorkspaceSwitcherPopover: WorkspaceSwitcherPopoverStub,
        SubscribeButton: SubscribeButtonStub,
        WorkspaceProfilePic: true,
        Divider: true
      }
    }
  })
}

describe('CurrentUserPopoverWorkspace', () => {
  beforeEach(() => {
    useCurrentUser().userDisplayName = computed(() => 'Liz')
    useCurrentUser().userEmail = computed(() => 'liz@example.com')
    useCurrentUser().userPhotoUrl = computed(() => null)
    state.isCloud = true
    state.balance = { amountMicros: 100 }
    state.billingStatus = 'paid'
    state.canAccessSubscriptionFeatures = true
    state.isCancelled = false
    state.planSlug = 'pro-monthly'
    useBillingCapabilities().canTopUp = computed(() => false)

    state.canManageSubscription = false
    state.canManageSubscriptionLifecycle = false
    state.canOpenPricingSurface = false

    state.shouldUseWorkspaceBilling = true
    vi.mocked(useFeatureFlags().flags).hostedBillingDestination = 'stripe'
    state.billingWebUrl = new URL('http://localhost:5174')
    const billingContext = useBillingContext()
    billingContext.billingStatus = computed(() => state.billingStatus)
    billingContext.canAccessSubscriptionFeatures = computed(
      () => state.canAccessSubscriptionFeatures
    )
    billingContext.subscription = computed(
      () =>
        ({
          isActive: true,
          tier: null,
          duration: null,
          isCancelled: state.isCancelled,
          planSlug: state.planSlug,
          scheduledChange: null,
          renewalDate: null,
          endDate: null,
          hasFunds: true,
          agentHasFunds: true
        }) satisfies SubscriptionInfo
    )
    billingContext.balance = computed(() =>
      state.balance
        ? ({ currency: 'USD', ...state.balance } satisfies BalanceInfo)
        : null
    )
    billingContext.isLoading = ref(false)
    vi.mocked(useBillingContext).mockReturnValue(billingContext)
    const workspaceUI = vi.mocked(useWorkspaceUI())
    workspaceUI.permissions = computed(() => ({
      canViewOtherMembers: false,
      canViewPendingInvites: false,
      canLeaveWorkspace: false,
      canAccessWorkspaceMenu: false,
      canManageSubscription: state.canManageSubscription,
      canManageSubscriptionLifecycle: state.canManageSubscriptionLifecycle,
      canDowngradeToPersonal: false
    }))
    workspaceUI.canReactivatePlan = computed(() => state.canReactivatePlan)
    workspaceUI.canOpenPricingSurface = computed(
      () => state.canOpenPricingSurface
    )
    const billingRouting = vi.mocked(useBillingRouting())
    billingRouting.shouldUseWorkspaceBilling = computed(
      () => state.shouldUseWorkspaceBilling
    )
  })

  it('toggles the workspace switcher panel from the selector row', async () => {
    const user = userEvent.setup()
    renderComponent()
    const trigger = screen.getByTestId('workspace-switcher-trigger')

    expect(
      screen.queryByTestId('workspace-switcher-panel')
    ).not.toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-controls', 'workspace-switcher-panel')

    await user.click(trigger)
    const panel = screen.getByTestId('workspace-switcher-panel')
    expect(panel).toHaveAttribute('id', 'workspace-switcher-panel')
    expect(panel).toHaveAttribute('role', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    await user.click(trigger)
    expect(
      screen.queryByTestId('workspace-switcher-panel')
    ).not.toBeInTheDocument()
  })

  it('closes the workspace switcher panel on Escape', async () => {
    const user = userEvent.setup()
    renderComponent()
    const trigger = screen.getByTestId('workspace-switcher-trigger')

    await user.click(trigger)
    await user.keyboard('{Escape}')

    expect(
      screen.queryByTestId('workspace-switcher-panel')
    ).not.toBeInTheDocument()
  })

  it('keeps account actions available without workspace context', () => {
    renderComponent('personal', true)

    expect(screen.getByTestId('user-settings-menu-item')).toBeInTheDocument()
    expect(screen.getByTestId('logout-menu-item')).toBeInTheDocument()
    expect(
      screen.queryByTestId('workspace-switcher-trigger')
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('credits-info-button')).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('workspace-settings-menu-item')
    ).not.toBeInTheDocument()
  })

  it('exposes the full workspace name on hover', async () => {
    const user = userEvent.setup()
    renderComponent('team')

    await user.hover(screen.getByTestId('workspace-switcher-trigger'))

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toHaveTextContent('Team Workspace')
    })
  })

  it('closes the switcher panel after selecting a workspace', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByTestId('workspace-switcher-trigger'))
    await user.click(screen.getByTestId('stub-select-workspace'))

    expect(
      screen.queryByTestId('workspace-switcher-panel')
    ).not.toBeInTheDocument()
  })

  it('opens the create-workspace dialog and closes the popover on create', async () => {
    const user = userEvent.setup()
    const { emitted } = renderComponent()

    await user.click(screen.getByTestId('workspace-switcher-trigger'))
    await user.click(screen.getByTestId('stub-create-workspace'))

    expect(useDialogService().showCreateWorkspaceDialog).toHaveBeenCalled()
    expect(emitted('close')).toHaveLength(1)
    expect(
      screen.queryByTestId('workspace-switcher-panel')
    ).not.toBeInTheDocument()
  })

  it('keeps a team workspace member read-only', () => {
    renderComponent('team')

    expect(screen.getByText('211')).toBeInTheDocument()
    expect(screen.queryByTestId('add-credits-button')).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('upgrade-to-add-credits-button')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('plans-pricing-menu-item')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('manage-plan-menu-item')
    ).not.toBeInTheDocument()
  })

  /**
   * Plan selection stays in the app regardless of `hosted_billing_destination`:
   * billing-web's `/v1/pricing` has no personal/team tabs, cycle toggle, or
   * credit slider, so the avatar menu always opens the in-app table. Only a
   * Subscribe click inside that table (`useSubscriptionCheckout`) hands off
   * to billing-web, covered in its own suite.
   */
  it.for(['stripe', 'billing_web'] as const)(
    'always opens the in-app pricing table, never a tab, when the destination is %s',
    async (destination) => {
      const user = userEvent.setup()
      const open = vi.spyOn(window, 'open')
      state.canOpenPricingSurface = true
      vi.mocked(useFeatureFlags().flags).hostedBillingDestination = destination
      renderComponent('team')

      await user.click(screen.getByTestId('plans-pricing-menu-item'))

      expect(useSubscriptionDialog().showPricingTable).toHaveBeenCalledWith({
        reason: 'avatar_menu_plans'
      })
      expect(open).not.toHaveBeenCalled()
    }
  )

  it('offers subscription when top-up is denied but self-serve is allowed', async () => {
    const user = userEvent.setup()
    useBillingCapabilities().canSubscribeSelfServe = computed(() => true)
    renderComponent('team')

    await user.click(screen.getByTestId('upgrade-to-add-credits-button'))

    expect(useSubscriptionDialog().showPricingTable).toHaveBeenCalledWith({
      reason: 'upgrade_to_add_credits'
    })
  })

  it.for(['payment_failed', 'paused'] as const)(
    'keeps Manage plan available for an existing %s subscription',
    (billingStatus) => {
      state.billingStatus = billingStatus
      state.canAccessSubscriptionFeatures = false
      state.canManageSubscription = true

      renderComponent('team')

      expect(screen.getByTestId('manage-plan-menu-item')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Subscribe' })
      ).not.toBeInTheDocument()
    }
  )

  it('shows the upgrade upsell instead of Manage plan when payment_failed has no plan', () => {
    state.billingStatus = 'payment_failed'
    state.canAccessSubscriptionFeatures = false
    state.canManageSubscription = true
    useBillingCapabilities().canSubscribeSelfServe = computed(() => true)
    state.planSlug = null

    renderComponent('team')

    expect(
      screen.queryByTestId('manage-plan-menu-item')
    ).not.toBeInTheDocument()
    expect(
      screen.getByTestId('upgrade-to-add-credits-button')
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Subscribe' })
    ).not.toBeInTheDocument()
  })

  it('keeps Subscribe hidden on Local after switching to an unsubscribed workspace', async () => {
    state.isCloud = false
    state.canAccessSubscriptionFeatures = false
    state.canManageSubscription = true
    const { rerender } = renderComponent('personal')

    expect(
      screen.queryByRole('button', { name: 'Subscribe' })
    ).not.toBeInTheDocument()

    Object.assign(useTeamWorkspaceStore(), { workspaceName: 'Team Workspace' })
    Object.assign(useTeamWorkspaceStore(), { isInPersonalWorkspace: false })
    await rerender({})

    expect(screen.getByTestId('workspace-switcher-trigger')).toHaveTextContent(
      'Team Workspace'
    )
    expect(
      screen.queryByRole('button', { name: 'Subscribe' })
    ).not.toBeInTheDocument()
  })

  it('lets an owner add credits on Local without an active subscription', async () => {
    const user = userEvent.setup()
    state.isCloud = false
    state.canAccessSubscriptionFeatures = false
    useBillingCapabilities().canTopUp = computed(() => true)

    renderComponent('personal')

    expect(
      screen.queryByTestId('upgrade-to-add-credits-button')
    ).not.toBeInTheDocument()
    await user.click(screen.getByTestId('add-credits-button'))

    expect(useDialogService().showTopUpCreditsDialog).toHaveBeenCalledOnce()
  })

  it('offers add-credits alongside Subscribe for an unsubscribed Cloud owner', () => {
    state.canAccessSubscriptionFeatures = false
    useBillingCapabilities().canTopUp = computed(() => true)
    useBillingCapabilities().canSubscribeSelfServe = computed(() => true)
    state.canManageSubscription = true

    renderComponent('personal')

    expect(screen.getByTestId('add-credits-button')).toBeInTheDocument()
    expect(
      screen.queryByTestId('upgrade-to-add-credits-button')
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Subscribe' })
    ).toBeInTheDocument()
  })

  it('offers add-credits instead of the upgrade upsell on the Local free tier', () => {
    state.isCloud = false
    useBillingCapabilities().canTopUp = computed(() => true)

    renderComponent('personal')

    expect(
      screen.queryByTestId('upgrade-to-add-credits-button')
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('add-credits-button')).toBeInTheDocument()
  })

  it('shows one subscription CTA on the Cloud free tier', () => {
    state.canAccessSubscriptionFeatures = false
    useBillingCapabilities().canSubscribeSelfServe = computed(() => true)

    renderComponent('personal')

    expect(
      screen.getByTestId('upgrade-to-add-credits-button')
    ).toBeInTheDocument()
    expect(screen.queryByTestId('add-credits-button')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Subscribe' })
    ).not.toBeInTheDocument()
  })

  it('keeps Resubscribe hidden on Local for a cancelled plan', () => {
    state.isCloud = false
    state.isCancelled = true
    state.canManageSubscriptionLifecycle = true
    useBillingCapabilities().canReactivate = computed(() => true)

    renderComponent('team')

    expect(
      screen.queryByRole('button', { name: 'Resubscribe' })
    ).not.toBeInTheDocument()
  })

  it.for([
    {
      name: 'allows a lifecycle manager to resubscribe a cancelled plan',
      canAccessSubscriptionFeatures: true,
      isCancelled: true,
      canManageSubscription: false,
      canManageSubscriptionLifecycle: true,
      canReactivate: true,
      canSubscribeSelfServe: false,
      canTopUp: false,
      action: 'Resubscribe',
      visible: true
    },
    {
      name: 'does not let a subscription manager resubscribe a cancelled plan',
      canAccessSubscriptionFeatures: true,
      isCancelled: true,
      canManageSubscription: true,
      canManageSubscriptionLifecycle: false,
      canReactivate: false,
      canSubscribeSelfServe: false,
      canTopUp: false,
      action: 'Resubscribe',
      visible: false
    },
    {
      name: 'does not resubscribe a cancelled plan when the server denies reactivation to a client-side owner',
      canAccessSubscriptionFeatures: true,
      isCancelled: true,
      canManageSubscription: true,
      canManageSubscriptionLifecycle: true,
      canReactivate: false,
      canSubscribeSelfServe: false,
      canTopUp: false,
      action: 'Resubscribe',
      visible: false
    },
    {
      name: 'allows a subscription manager to subscribe an inaccessible plan',
      canAccessSubscriptionFeatures: false,
      isCancelled: false,
      canManageSubscription: true,
      canManageSubscriptionLifecycle: false,
      canReactivate: false,
      canSubscribeSelfServe: true,
      canTopUp: true,
      action: 'Subscribe',
      visible: true
    },
    {
      name: 'does not let a lifecycle manager subscribe an inaccessible plan',
      canAccessSubscriptionFeatures: false,
      isCancelled: false,
      canManageSubscription: false,
      canManageSubscriptionLifecycle: true,
      canReactivate: true,
      canSubscribeSelfServe: false,
      canTopUp: false,
      action: 'Subscribe',
      visible: false
    }
  ])(
    '$name',
    ({
      canAccessSubscriptionFeatures,
      isCancelled,
      canManageSubscription,
      canManageSubscriptionLifecycle,
      canReactivate,
      canSubscribeSelfServe,
      canTopUp,
      action,
      visible
    }) => {
      state.canAccessSubscriptionFeatures = canAccessSubscriptionFeatures
      state.isCancelled = isCancelled
      state.canManageSubscription = canManageSubscription
      state.canManageSubscriptionLifecycle = canManageSubscriptionLifecycle
      state.canReactivatePlan = canReactivate
      useBillingCapabilities().canSubscribeSelfServe = computed(
        () => canSubscribeSelfServe
      )
      useBillingCapabilities().canTopUp = computed(() => canTopUp)

      renderComponent('team')

      const subscribeAction = screen.queryByRole('button', { name: action })
      if (visible) {
        expect(subscribeAction).toBeInTheDocument()
      } else {
        expect(subscribeAction).not.toBeInTheDocument()
      }
    }
  )

  it('keeps billing controls and resubscribe available to a promoted owner', async () => {
    const user = userEvent.setup()
    state.isCancelled = true
    useBillingCapabilities().canTopUp = computed(() => true)
    state.canManageSubscription = true
    state.canManageSubscriptionLifecycle = true
    state.canReactivatePlan = true
    state.canOpenPricingSurface = true
    vi.mocked(useFeatureFlags().flags).hostedBillingDestination = 'billing_web'
    renderComponent('team')

    expect(screen.getByTestId('add-credits-button')).toBeInTheDocument()
    expect(screen.getByTestId('plans-pricing-menu-item')).toBeInTheDocument()
    expect(screen.getByTestId('manage-plan-menu-item')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Resubscribe' }))

    expect(useSubscriptionDialog().showPricingTable).toHaveBeenCalledOnce()
  })

  it('hides Plans & pricing on a sales-managed plan but keeps Manage plan', () => {
    // Server-resolved for Enterprise/unrecognized tiers: no self-serve
    // catalog, so canOpenPricingSurface resolves false while the plan is
    // still manageable through settings.
    state.canManageSubscription = true
    state.canOpenPricingSurface = false
    renderComponent('team')

    expect(
      screen.queryByTestId('plans-pricing-menu-item')
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('manage-plan-menu-item')).toBeInTheDocument()
  })

  it('hides Resubscribe for a cancelled sales-managed plan', () => {
    state.isCancelled = true
    state.canManageSubscription = true
    state.canManageSubscriptionLifecycle = true
    state.canReactivatePlan = false
    renderComponent('team')

    expect(
      screen.queryByRole('button', { name: 'Resubscribe' })
    ).not.toBeInTheDocument()
  })

  it('reads the derived reactivate policy, not the raw server capability', () => {
    state.isCancelled = true
    state.canManageSubscriptionLifecycle = true
    // The legacy rail resolves can_reactivate false but still permits
    // reactivation, so the button must follow canReactivatePlan. Rail
    // selection itself is covered in useWorkspaceUI.test.ts.
    state.canReactivatePlan = true

    renderComponent('personal')

    expect(
      screen.getByRole('button', { name: 'Resubscribe' })
    ).toBeInTheDocument()
  })

  for (const workspaceType of ['personal', 'team'] as const) {
    it(`opens workspace plan management for a ${workspaceType} owner`, async () => {
      const user = userEvent.setup()
      state.canManageSubscription = true
      const { emitted } = renderComponent(workspaceType)

      const menuItem = screen.getByRole('button', {
        name: enMessages.subscription.managePlan
      })
      expect(menuItem).toHaveTextContent(enMessages.subscription.managePlan)

      menuItem.focus()
      await user.keyboard('{Enter}')

      expect(useSettingsDialog().show).toHaveBeenCalledWith('workspace')
      expect(emitted('close')).toHaveLength(1)
    })
  }

  it('opens local Plan and Credits instead of Cloud pricing actions', async () => {
    state.isCloud = false
    state.canManageSubscription = true
    const user = userEvent.setup()
    const { emitted } = renderComponent()

    expect(
      screen.queryByTestId('plans-pricing-menu-item')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('manage-plan-menu-item')
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', {
        name: enMessages.subscription.plansAndCredits
      })
    )

    expect(useSettingsDialog().show).toHaveBeenCalledWith('workspace')
    expect(useSubscriptionDialog().showPricingTable).not.toHaveBeenCalled()
    expect(emitted('close')).toHaveLength(1)
  })

  it('hides local Plan and Credits without subscription management permission', () => {
    state.isCloud = false

    renderComponent()

    expect(
      screen.queryByTestId('plans-credits-menu-item')
    ).not.toBeInTheDocument()
  })

  // Paired with the negative case above: on its own, "hidden without
  // permission" can pass vacuously if the item is missing for an unrelated
  // reason (e.g. a renamed/merged testid), so this asserts the item actually
  // renders once the only gating permission is granted.
  it('shows local Plan and Credits with subscription management permission', () => {
    state.isCloud = false
    state.canManageSubscription = true

    renderComponent()

    expect(screen.getByTestId('plans-credits-menu-item')).toBeInTheDocument()
  })

  // The pair above only varies the permission, so both cases would still pass
  // if the Local-only guard were dropped. This varies the distribution instead.
  it('hides local Plan and Credits on Cloud', () => {
    state.canManageSubscription = true

    renderComponent()

    expect(
      screen.queryByTestId('plans-credits-menu-item')
    ).not.toBeInTheDocument()
  })

  // FE-3164: the row used to coerce a missing balance with `?? 0`, so a failed
  // balance read showed `0` coins beside an untouched ledger — the user's whole
  // balance apparently gone, with no error and no way to ask again.
  describe('credits row with no balance read', () => {
    it('shows an unavailable amount rather than zero', () => {
      state.balance = null

      renderComponent()

      const amount = screen.getByTestId('credits-amount')
      expect(amount).toHaveTextContent('—')
      expect(amount).not.toHaveTextContent('0')
      expect(amount).toHaveAttribute('title', 'Balance unavailable')
    })

    it('offers a retry that re-reads the balance', async () => {
      const user = userEvent.setup()
      state.balance = null
      const { fetchBalance } = useBillingContext()

      renderComponent()

      const retry = screen.getByTestId('retry-balance-button')
      expect(retry).toHaveAttribute('aria-label', 'Balance unavailable. Retry')

      await user.click(retry)
      expect(fetchBalance).toHaveBeenCalled()
    })

    it('shows the amount with no retry once a balance has been read', () => {
      state.balance = { amountMicros: 100 }

      renderComponent()

      expect(screen.getByTestId('credits-amount')).toHaveTextContent('211')
      expect(
        screen.queryByTestId('retry-balance-button')
      ).not.toBeInTheDocument()
    })

    // `initState` is the workspace store's lifecycle, not billing's, so it
    // reaches `ready` while the balance read is still out. The retry used to
    // render in that window, beside the loading skeleton — two controls making
    // opposite claims about the same figure at the same time.
    it('offers no retry while the first balance read is still in flight', () => {
      state.balance = null
      useBillingContext().isLoading = ref(true)

      renderComponent()

      expect(
        screen.queryByTestId('retry-balance-button')
      ).not.toBeInTheDocument()
      // The skeleton is showing, so there is no amount element at all yet.
      expect(screen.queryByTestId('credits-amount')).not.toBeInTheDocument()
    })

    // `authStore.fetchBalance` has no request-sequence guard, so two concurrent
    // reads can resolve out of order and leave the older response displayed.
    // The browser case additionally proves the in-flight guard holds against a
    // dispatched click, which a real user cannot produce on a disabled control.
    it('marks the retry busy and starts no second read while one is open', async () => {
      const user = userEvent.setup()
      state.balance = null
      const { fetchBalance } = useBillingContext()
      let finishRead: (() => void) | undefined
      vi.mocked(fetchBalance).mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            finishRead = resolve
          })
      )

      renderComponent()

      const retry = screen.getByTestId('retry-balance-button')
      await user.click(retry)
      expect(fetchBalance).toHaveBeenCalledTimes(1)
      // Visible feedback, so the click does not look inert.
      await waitFor(() => expect(retry).toBeDisabled())
      expect(retry).toHaveAttribute('aria-busy', 'true')

      await user.click(retry)
      expect(fetchBalance).toHaveBeenCalledTimes(1)

      finishRead?.()
      await waitFor(() => expect(retry).not.toBeDisabled())
      await user.click(retry)
      expect(fetchBalance).toHaveBeenCalledTimes(2)
    })

    // The default error handler toasts `error.message`, and on the legacy rail
    // that message is assembled from the upstream payment-provider response
    // body — one click would put raw upstream text in front of the user.
    it('reports a failed retry without showing the upstream message', async () => {
      const user = userEvent.setup()
      state.balance = null
      const { fetchBalance } = useBillingContext()
      const upstream = new Error(
        'failed to fetch balance: metronome 502 customer_id not found'
      )
      vi.mocked(fetchBalance).mockRejectedValue(upstream)
      const add = vi.spyOn(useToastStore(), 'add')

      renderComponent()

      await user.click(screen.getByTestId('retry-balance-button'))

      await waitFor(() => expect(add).toHaveBeenCalledOnce())
      const detail = String(add.mock.calls[0][0].detail)
      expect(detail).not.toContain('metronome')
      expect(detail).toBe(enMessages.subscription.balanceUnavailableRetryFailed)
      expect(reportError).toHaveBeenCalledWith(
        upstream,
        expect.objectContaining({ surface: 'billing' })
      )
    })

    it('still shows a known zero balance as zero', () => {
      state.balance = { amountMicros: 0 }

      renderComponent()

      const amount = screen.getByTestId('credits-amount')
      // Anchored so a wrong non-zero figure such as `10` cannot satisfy the
      // substring match and read as a correct known zero.
      expect(amount).toHaveTextContent(/^0$/)
      expect(amount).not.toHaveAttribute('title')
      expect(
        screen.queryByTestId('retry-balance-button')
      ).not.toBeInTheDocument()
    })
  })
})
