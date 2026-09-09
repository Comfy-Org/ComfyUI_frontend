import { createTestingPinia } from '@pinia/testing'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

import CurrentUserPopoverWorkspace from './CurrentUserPopoverWorkspace.vue'

const state = vi.hoisted(() => ({
  isCloud: true,
  billingStatus: 'paid',
  canAccessSubscriptionFeatures: true,
  isCancelled: false,
  planSlug: 'pro-monthly' as string | null,
  canTopUp: false,
  canSubscribeSelfServe: false,
  canManageSubscription: false,
  canManageSubscriptionLifecycle: false,
  canReactivate: false,
  canReactivatePlan: false,
  canOpenPricingSurface: false,
  shouldUseWorkspaceBilling: true,
  showCreateWorkspaceDialog: vi.fn(),
  showTopUpCreditsDialog: vi.fn(),
  showPricingTable: vi.fn(),
  showSettingsDialog: vi.fn()
}))

const workspaceStoreMock = vi.hoisted(() => ({
  store: null as null | {
    initState: string
    workspaceName: string
    isInPersonalWorkspace: boolean
  }
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', async () => {
  const { reactive, ref } = await import('vue')
  workspaceStoreMock.store = reactive({
    initState: ref('ready'),
    workspaceName: ref('Personal Workspace'),
    isInPersonalWorkspace: ref(true)
  })
  return { useTeamWorkspaceStore: () => workspaceStoreMock.store }
})

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    userDisplayName: ref('Liz'),
    userEmail: ref('liz@example.com'),
    userPhotoUrl: ref(null),
    handleSignOut: vi.fn()
  })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    billingStatus: computed(() => state.billingStatus),
    canAccessSubscriptionFeatures: computed(
      () => state.canAccessSubscriptionFeatures
    ),
    subscription: computed(() => ({
      isCancelled: state.isCancelled,
      planSlug: state.planSlug
    })),
    balance: ref({ amountMicros: 100 }),
    isLoading: ref(false),
    fetchBalance: vi.fn()
  })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({
    permissions: computed(() => ({
      canManageSubscription: state.canManageSubscription,
      canManageSubscriptionLifecycle: state.canManageSubscriptionLifecycle
    })),
    canReactivatePlan: computed(() => state.canReactivatePlan),
    canOpenPricingSurface: computed(() => state.canOpenPricingSurface)
  })
}))

vi.mock('@/platform/workspace/composables/useBillingCapabilities', () => ({
  useBillingCapabilities: () => ({
    canTopUp: computed(() => state.canTopUp),
    canSubscribeSelfServe: computed(() => state.canSubscribeSelfServe),
    canReactivate: computed(() => state.canReactivate)
  })
}))

vi.mock('@/composables/billing/useBillingRouting', () => ({
  useBillingRouting: () => ({
    shouldUseWorkspaceBilling: computed(() => state.shouldUseWorkspaceBilling)
  })
}))

vi.mock(
  '@/platform/cloud/subscription/composables/useSubscriptionDialog',
  () => ({
    useSubscriptionDialog: () => ({ showPricingTable: state.showPricingTable })
  })
)

vi.mock('@/platform/settings/composables/useSettingsDialog', () => ({
  useSettingsDialog: () => ({ show: state.showSettingsDialog })
}))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return state.isCloud
  }
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    showCreateWorkspaceDialog: state.showCreateWorkspaceDialog,
    showTopUpCreditsDialog: state.showTopUpCreditsDialog
  })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => undefined
}))

vi.mock('@/composables/useExternalLink', () => ({
  useExternalLink: () => ({
    buildDocsUrl: vi.fn(() => 'https://docs.comfy.org'),
    docsPaths: { partnerNodesPricing: 'partner-nodes' }
  })
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
  if (!workspaceStoreMock.store) throw new Error('Workspace store not ready')
  workspaceStoreMock.store.workspaceName = `${type === 'personal' ? 'Personal' : 'Team'} Workspace`
  workspaceStoreMock.store.isInPersonalWorkspace = type === 'personal'
  return render(CurrentUserPopoverWorkspace, {
    props: { accountActionsOnly },
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn
        }),
        PrimeVue,
        i18n
      ],
      directives: {
        tooltip: Tooltip
      },
      stubs: {
        WorkspaceSwitcherPopover: WorkspaceSwitcherPopoverStub,
        SubscribeButton: SubscribeButtonStub,
        UserAvatar: true,
        WorkspaceProfilePic: true,
        Skeleton: true,
        Divider: true
      }
    }
  })
}

describe('CurrentUserPopoverWorkspace', () => {
  beforeEach(() => {
    state.isCloud = true
    state.billingStatus = 'paid'
    state.canAccessSubscriptionFeatures = true
    state.isCancelled = false
    state.planSlug = 'pro-monthly'
    state.canTopUp = false
    state.canSubscribeSelfServe = false
    state.canManageSubscription = false
    state.canManageSubscriptionLifecycle = false
    state.canOpenPricingSurface = false
    state.canReactivate = false
    state.shouldUseWorkspaceBilling = true
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

    expect(state.showCreateWorkspaceDialog).toHaveBeenCalled()
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

  it('offers subscription when top-up is denied but self-serve is allowed', async () => {
    const user = userEvent.setup()
    state.canSubscribeSelfServe = true
    renderComponent('team')

    await user.click(screen.getByTestId('upgrade-to-add-credits-button'))

    expect(state.showPricingTable).toHaveBeenCalledWith({
      reason: 'upgrade_to_add_credits'
    })
  })

  it.for(['payment_failed', 'paused'])(
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

  it('shows Subscribe instead of Manage plan when payment_failed has no plan', () => {
    state.billingStatus = 'payment_failed'
    state.canAccessSubscriptionFeatures = false
    state.canManageSubscription = true
    state.canSubscribeSelfServe = true
    state.planSlug = null

    renderComponent('team')

    expect(
      screen.queryByTestId('manage-plan-menu-item')
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Subscribe' })
    ).toBeInTheDocument()
  })

  it('keeps Subscribe hidden on Local after switching to an unsubscribed workspace', async () => {
    state.isCloud = false
    state.canAccessSubscriptionFeatures = false
    state.canManageSubscription = true
    const { rerender } = renderComponent('personal')

    expect(
      screen.queryByRole('button', { name: 'Subscribe' })
    ).not.toBeInTheDocument()

    if (!workspaceStoreMock.store) throw new Error('Workspace store not ready')
    workspaceStoreMock.store.workspaceName = 'Team Workspace'
    workspaceStoreMock.store.isInPersonalWorkspace = false
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
    state.canTopUp = true

    renderComponent('personal')

    expect(
      screen.queryByTestId('upgrade-to-add-credits-button')
    ).not.toBeInTheDocument()
    await user.click(screen.getByTestId('add-credits-button'))

    expect(state.showTopUpCreditsDialog).toHaveBeenCalledOnce()
  })

  it('offers add-credits alongside Subscribe for an unsubscribed Cloud owner', () => {
    state.canAccessSubscriptionFeatures = false
    state.canTopUp = true
    state.canSubscribeSelfServe = true
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
    state.canTopUp = true

    renderComponent('personal')

    expect(
      screen.queryByTestId('upgrade-to-add-credits-button')
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('add-credits-button')).toBeInTheDocument()
  })

  it('keeps the upgrade upsell for the Cloud free tier', () => {
    state.canTopUp = false
    state.canSubscribeSelfServe = true

    renderComponent('personal')

    expect(
      screen.getByTestId('upgrade-to-add-credits-button')
    ).toBeInTheDocument()
    expect(screen.queryByTestId('add-credits-button')).not.toBeInTheDocument()
  })

  it('keeps Resubscribe hidden on Local for a cancelled plan', () => {
    state.isCloud = false
    state.isCancelled = true
    state.canManageSubscriptionLifecycle = true
    state.canReactivate = true

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
      action,
      visible
    }) => {
      state.canAccessSubscriptionFeatures = canAccessSubscriptionFeatures
      state.isCancelled = isCancelled
      state.canManageSubscription = canManageSubscription
      state.canManageSubscriptionLifecycle = canManageSubscriptionLifecycle
      state.canReactivatePlan = canReactivate
      state.canSubscribeSelfServe = canSubscribeSelfServe

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
    state.canTopUp = true
    state.canManageSubscription = true
    state.canManageSubscriptionLifecycle = true
    state.canReactivatePlan = true
    state.canOpenPricingSurface = true
    renderComponent('team')

    expect(screen.getByTestId('add-credits-button')).toBeInTheDocument()
    expect(screen.getByTestId('plans-pricing-menu-item')).toBeInTheDocument()
    expect(screen.getByTestId('manage-plan-menu-item')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Resubscribe' }))

    expect(state.showPricingTable).toHaveBeenCalledOnce()
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
    state.canReactivate = false
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
    state.canReactivate = false
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

      expect(state.showSettingsDialog).toHaveBeenCalledWith('workspace')
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

    expect(state.showSettingsDialog).toHaveBeenCalledWith('workspace')
    expect(state.showPricingTable).not.toHaveBeenCalled()
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
})
