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
  billingStatus: 'paid',
  canAccessSubscriptionFeatures: true,
  isFreeTier: false,
  isCancelled: false,
  planSlug: 'pro-monthly' as string | null,
  canTopUp: false,
  canManageSubscription: false,
  canManageSubscriptionLifecycle: false,
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
    isFreeTier: computed(() => state.isFreeTier),
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
      canTopUp: state.canTopUp,
      canManageSubscription: state.canManageSubscription,
      canManageSubscriptionLifecycle: state.canManageSubscriptionLifecycle
    }))
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

vi.mock('@/platform/distribution/types', () => ({ isCloud: true }))

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
        SubscribeButton: true,
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
    state.billingStatus = 'paid'
    state.canAccessSubscriptionFeatures = true
    state.isFreeTier = false
    state.isCancelled = false
    state.planSlug = 'pro-monthly'
    state.canTopUp = false
    state.canManageSubscription = false
    state.canManageSubscriptionLifecycle = false
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
    state.planSlug = null

    renderComponent('team')

    expect(
      screen.queryByTestId('manage-plan-menu-item')
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Subscribe' })
    ).toBeInTheDocument()
  })

  it.for([
    {
      name: 'allows a lifecycle manager to resubscribe a cancelled plan',
      canAccessSubscriptionFeatures: true,
      isCancelled: true,
      canManageSubscription: false,
      canManageSubscriptionLifecycle: true,
      action: 'Resubscribe',
      visible: true
    },
    {
      name: 'does not let a subscription manager resubscribe a cancelled plan',
      canAccessSubscriptionFeatures: true,
      isCancelled: true,
      canManageSubscription: true,
      canManageSubscriptionLifecycle: false,
      action: 'Resubscribe',
      visible: false
    },
    {
      name: 'allows a subscription manager to subscribe an inaccessible plan',
      canAccessSubscriptionFeatures: false,
      isCancelled: false,
      canManageSubscription: true,
      canManageSubscriptionLifecycle: false,
      action: 'Subscribe',
      visible: true
    },
    {
      name: 'does not let a lifecycle manager subscribe an inaccessible plan',
      canAccessSubscriptionFeatures: false,
      isCancelled: false,
      canManageSubscription: false,
      canManageSubscriptionLifecycle: true,
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
      action,
      visible
    }) => {
      state.canAccessSubscriptionFeatures = canAccessSubscriptionFeatures
      state.isCancelled = isCancelled
      state.canManageSubscription = canManageSubscription
      state.canManageSubscriptionLifecycle = canManageSubscriptionLifecycle

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
    renderComponent('team')

    expect(screen.getByTestId('add-credits-button')).toBeInTheDocument()
    expect(screen.getByTestId('plans-pricing-menu-item')).toBeInTheDocument()
    expect(screen.getByTestId('manage-plan-menu-item')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Resubscribe' }))

    expect(state.showPricingTable).toHaveBeenCalledOnce()
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
})
