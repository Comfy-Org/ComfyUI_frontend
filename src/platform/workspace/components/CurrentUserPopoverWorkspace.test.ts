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
  canAccessSubscriptionFeatures: true,
  isFreeTier: false,
  isCancelled: false,
  canTopUp: false,
  canManageSubscription: false,
  canManageSubscriptionLifecycle: false,
  showCreateWorkspaceDialog: vi.fn(),
  showTopUpCreditsDialog: vi.fn(),
  showPricingTable: vi.fn()
}))

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
    canAccessSubscriptionFeatures: computed(() => state.canAccessSubscriptionFeatures),
    isFreeTier: computed(() => state.isFreeTier),
    subscription: computed(() => ({
      isCancelled: state.isCancelled
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
  useSettingsDialog: () => ({ show: vi.fn() })
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

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function createWorkspaceState(
  type: 'personal' | 'team',
  role: 'owner' | 'member'
) {
  return {
    id: `ws-${type}`,
    name: `${type === 'personal' ? 'Personal' : 'Team'} Workspace`,
    type,
    role,
    created_at: '2026-01-01T00:00:00Z',
    joined_at: '2026-01-01T00:00:00Z',
    isSubscribed: true,
    subscriptionPlan: 'team-pro-monthly',
    subscriptionTier: 'PRO',
    members: [],
    pendingInvites: []
  }
}

function renderComponent(
  type: 'personal' | 'team' = 'personal',
  role: 'owner' | 'member' = 'member'
) {
  return render(CurrentUserPopoverWorkspace, {
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          initialState: {
            teamWorkspace: {
              initState: 'ready',
              activeWorkspaceId: `ws-${type}`,
              workspaces: [createWorkspaceState(type, role)]
            }
          }
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
    state.canAccessSubscriptionFeatures = true
    state.isFreeTier = false
    state.isCancelled = false
    state.canTopUp = false
    state.canManageSubscription = false
    state.canManageSubscriptionLifecycle = false
    vi.clearAllMocks()
  })

  it('toggles the workspace switcher panel from the selector row', async () => {
    const user = userEvent.setup()
    renderComponent()

    expect(
      screen.queryByTestId('workspace-switcher-panel')
    ).not.toBeInTheDocument()

    await user.click(screen.getByTestId('workspace-switcher-trigger'))
    expect(screen.getByTestId('workspace-switcher-panel')).toBeInTheDocument()

    await user.click(screen.getByTestId('workspace-switcher-trigger'))
    expect(
      screen.queryByTestId('workspace-switcher-panel')
    ).not.toBeInTheDocument()
  })

  it('exposes the full workspace name on hover', async () => {
    const user = userEvent.setup()
    renderComponent('team', 'member')

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

  it('keeps a Personal workspace Team-plan member read-only', () => {
    renderComponent('personal', 'member')

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

  it('keeps billing controls and resubscribe available to a promoted owner', async () => {
    const user = userEvent.setup()
    state.isCancelled = true
    state.canTopUp = true
    state.canManageSubscription = true
    state.canManageSubscriptionLifecycle = true
    renderComponent('team', 'owner')

    expect(screen.getByTestId('add-credits-button')).toBeInTheDocument()
    expect(screen.getByTestId('plans-pricing-menu-item')).toBeInTheDocument()
    expect(screen.getByTestId('manage-plan-menu-item')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Resubscribe' }))

    expect(state.showPricingTable).toHaveBeenCalledOnce()
  })
})
