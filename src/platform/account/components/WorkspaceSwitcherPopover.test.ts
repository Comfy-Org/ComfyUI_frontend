import { getActivePinia } from 'pinia'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import { reportError } from '@comfyorg/telemetry/reportError'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useWorkspaceBillingStateStore } from '@/platform/billing/stores/workspaceBillingStateStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import WorkspaceSwitcherPopover from '@/platform/account/components/WorkspaceSwitcherPopover.vue'

vi.mock(import('@/platform/workspace/composables/useWorkspaceSwitch'), () => ({
  useWorkspaceSwitch: () => ({ switchWorkspace: vi.fn() })
}))

vi.mock(import('@/platform/billing/composables/useBillingContext'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@comfyorg/telemetry/reportError'))

const distributionMocks = vi.hoisted(() => ({ isCloud: true }))

vi.mock(import('@/platform/distribution/types'), () => distributionMocks)

const LONG_WORKSPACE_NAME =
  'Quantum Renaissance Collective for Hyperdimensional Latent Diffusion Research and Experimental Workflow Engineering'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      workspaceSwitcher: {
        personal: 'Personal',
        roleOwner: 'Owner',
        roleMember: 'Member',
        scopeCaption: 'Workspaces only affect which credits you use.',
        scopeTooltip:
          'Runs that use partner nodes spend credits from this workspace. Unlike on Cloud, every workspace saves to your usual output folder.',
        createWorkspace: 'Create a team workspace',
        maxWorkspacesReached:
          'You can only own {max} workspace. Delete it to create a new one. | You can only own {max} workspaces. Delete one to create a new one.',
        managedByOrganization:
          "Your organization manages your workspaces, so you can't create one.",
        cannotCreateWorkspace:
          "You can't create a workspace on this account right now.",
        createWorkspaceAction: 'Create workspace',
        ownedLimit: 'You can own up to {max}.',
        searchPlaceholder: 'Search workspace...',
        noResults: 'No workspaces match “{query}”.',
        loadFailed: 'Couldn’t load your workspaces.',
        tryAgain: 'Try again'
      },
      profileMenu: {
        planStatus: {
          noPlan: 'No plan',
          paused: 'Paused',
          paymentDue: 'Payment due',
          ended: 'Plan ended'
        }
      },
      subscription: {
        tiers: {
          pro: { name: 'Pro' }
        }
      }
    }
  }
})

type WorkspaceState = ReturnType<
  typeof useTeamWorkspaceStore
>['workspaces'][number]

function createWorkspaceState(
  overrides: Pick<WorkspaceState, 'id' | 'name' | 'type' | 'role'> &
    Partial<WorkspaceState>
): WorkspaceState {
  return {
    created_at: '2026-01-01T00:00:00Z',
    joined_at: '2026-01-01T00:00:00Z',
    members: [],
    pendingInvites: [],
    membersLoaded: true,
    pendingInvitesLoaded: true,
    ...overrides
  }
}

function renderComponent(
  overrides: {
    activeWorkspaceId?: string
    workspaces?: WorkspaceState[]
  } = {}
) {
  const store: ReturnType<typeof useTeamWorkspaceStore> & {
    activeWorkspaceId: string | null
  } = useTeamWorkspaceStore()
  store.activeWorkspaceId = overrides.activeWorkspaceId ?? 'ws-personal'
  store.$patch({
    isFetchingWorkspaces: false,
    workspaces: overrides.workspaces ?? [
      createWorkspaceState({
        id: 'ws-personal',
        name: 'Personal Workspace',
        type: 'personal',
        role: 'owner'
      }),
      createWorkspaceState({
        id: 'ws-team-long',
        name: LONG_WORKSPACE_NAME,
        type: 'team',
        role: 'member'
      })
    ]
  })
  return render(WorkspaceSwitcherPopover, {
    global: {
      plugins: [getActivePinia()!, i18n],
      stubs: {
        WorkspaceProfilePic: true
      }
    }
  })
}

describe('WorkspaceSwitcherPopover', () => {
  it('shows the credits-scope caption off cloud', () => {
    distributionMocks.isCloud = false
    renderComponent()
    expect(
      screen.getByText('Workspaces only affect which credits you use.')
    ).toBeInTheDocument()

    distributionMocks.isCloud = true
  })

  beforeEach(() => {
    const billingContext = useBillingContext()
    billingContext.subscription = computed(() => null)
    vi.mocked(useBillingContext).mockReturnValue(billingContext)
    distributionMocks.isCloud = true
  })

  it.for([
    {
      type: 'personal',
      plan: 'free',
      isSubscribed: true,
      subscriptionPlan: null,
      subscriptionTier: 'FREE'
    },
    {
      type: 'personal',
      plan: 'paid',
      isSubscribed: true,
      subscriptionPlan: 'PRO_MONTHLY',
      subscriptionTier: 'PRO'
    },
    {
      type: 'team',
      plan: 'free',
      isSubscribed: false,
      subscriptionPlan: null,
      subscriptionTier: null
    },
    {
      type: 'team',
      plan: 'paid',
      isSubscribed: true,
      subscriptionPlan: 'team_per_credit_monthly',
      subscriptionTier: null
    }
  ] as const)(
    'shows a renamed $type workspace name on a $plan plan',
    ({ type, isSubscribed, subscriptionPlan, subscriptionTier }) => {
      useWorkspaceBillingStateStore().updateSummary(`ws-${type}`, {
        isSubscribed,
        subscriptionPlan
      })
      renderComponent({
        workspaces: [
          createWorkspaceState({
            id: `ws-${type}`,
            name: 'My Creative Workspace',
            type,
            role: 'owner',
            subscription_tier: subscriptionTier ?? undefined
          })
        ],
        activeWorkspaceId: `ws-${type}`
      })

      expect(screen.getByText('My Creative Workspace')).toHaveAttribute(
        'title',
        'My Creative Workspace'
      )
      expect(screen.queryByText('Personal')).not.toBeInTheDocument()
    }
  )

  it('exposes the full team workspace name as a tooltip on the row', () => {
    renderComponent()

    const name = screen.getByText(LONG_WORKSPACE_NAME)

    expect(name).toHaveAttribute('title', LONG_WORKSPACE_NAME)
  })

  it('does not render a tier badge on team workspace rows', () => {
    useBillingContext().subscription = computed(() => ({
      isActive: true,
      tier: 'PRO',
      duration: 'MONTHLY',
      planSlug: null,
      scheduledChange: null,
      renewalDate: null,
      endDate: null,
      isCancelled: false,
      hasFunds: true,
      agentHasFunds: true
    }))

    renderComponent({
      activeWorkspaceId: 'ws-team',
      workspaces: [
        createWorkspaceState({
          id: 'ws-personal',
          name: 'Personal Workspace',
          type: 'personal',
          role: 'owner'
        }),
        createWorkspaceState({
          id: 'ws-team',
          name: 'Team Comfy',
          type: 'team',
          role: 'owner',
          subscription_tier: 'PRO'
        })
      ]
    })

    expect(screen.getByText('Team Comfy')).toBeInTheDocument()
    expect(screen.queryByText('Pro')).not.toBeInTheDocument()
  })

  it('keeps the tier badge on a subscribed personal workspace row', () => {
    renderComponent({
      activeWorkspaceId: 'ws-team',
      workspaces: [
        createWorkspaceState({
          id: 'ws-personal',
          name: 'Personal Workspace',
          type: 'personal',
          role: 'owner',
          subscription_tier: 'PRO'
        }),
        createWorkspaceState({
          id: 'ws-team',
          name: 'Team Comfy',
          type: 'team',
          role: 'owner'
        })
      ]
    })

    expect(screen.getByText('Pro')).toBeInTheDocument()
  })

  it('renders every workspace row inside the scroll region and keeps the create-workspace footer outside it', () => {
    const workspaceNames = Array.from({ length: 25 }, (_, i) => `Team ${i}`)
    const workspaces = workspaceNames.map((name, i) =>
      createWorkspaceState({
        id: `ws-${i}`,
        name,
        type: 'team',
        role: 'member'
      })
    )

    renderComponent({ activeWorkspaceId: 'ws-0', workspaces })

    const list = screen.getByTestId('workspace-switcher-list')

    workspaceNames.forEach((name) => {
      expect(list).toContainElement(screen.getByText(name))
    })

    const createWorkspaceButton = screen.getByText('Create a team workspace')
    expect(list).not.toContainElement(createWorkspaceButton)
  })

  it.for([
    {
      reason: 'organization_managed',
      notice: /Your organization manages your workspaces/
    },
    {
      reason: 'owned_workspace_limit',
      notice: /You can only own 25 workspaces/
    },
    {
      reason: 'owned_workspace_limit',
      max: 1,
      notice: /You can only own 1 workspace\. Delete it/
    },
    { reason: undefined, notice: /can't create a workspace on this account/ }
  ] as const)(
    'renders the served refusal ($reason) in place of creating',
    async ({ reason, notice, max = 25 }) => {
      const store = useTeamWorkspaceStore()
      store.$patch({
        serverRefusesCreation: true,
        creationDeniedReason: reason,
        maxOwnedWorkspaces: max
      })
      const { emitted } = renderComponent()

      await userEvent.click(screen.getByText(notice))

      expect(screen.queryByText('Create a team workspace')).toBeNull()
      expect(emitted().create).toBeUndefined()
    }
  )

  it('hides the create-workspace footer on non-cloud distributions', () => {
    distributionMocks.isCloud = false

    renderComponent()

    expect(screen.queryByText('Create a team workspace')).toBeNull()
    expect(screen.queryByText(/You can only own 10 workspaces/)).toBeNull()
  })
})

describe('WorkspaceSwitcherPopover with billing_new_ux_enabled', () => {
  beforeEach(() => {
    vi.mocked(useFeatureFlags().flags).billingNewUxEnabled = true
    const billingContext = useBillingContext()
    billingContext.subscription = computed(() => null)
    vi.mocked(useBillingContext).mockReturnValue(billingContext)
    distributionMocks.isCloud = true
  })

  function teams(count: number) {
    return Array.from({ length: count }, (_, i) =>
      createWorkspaceState({
        id: `ws-${i}`,
        name: `Team ${i}`,
        type: 'team',
        role: 'member'
      })
    )
  }

  it('shows the served plan or status per row and drops the line when no summary is served', () => {
    renderComponent({
      activeWorkspaceId: 'ws-a',
      workspaces: [
        createWorkspaceState({
          id: 'ws-a',
          name: 'Workspace A',
          type: 'personal',
          role: 'owner',
          subscription_tier: 'PRO',
          plan_summary: { status: 'no_plan', plan_name: null }
        }),
        createWorkspaceState({
          id: 'ws-b',
          name: 'Team A',
          type: 'team',
          role: 'owner',
          plan_summary: { status: 'active', plan_name: 'Enterprise' }
        }),
        createWorkspaceState({
          id: 'ws-c',
          name: 'Team B',
          type: 'team',
          role: 'member',
          plan_summary: { status: 'payment_due', plan_name: 'Pro' }
        }),
        createWorkspaceState({
          id: 'ws-d',
          name: 'Team C',
          type: 'team',
          role: 'member'
        })
      ]
    })

    expect(
      screen
        .getAllByTestId('workspace-row-plan-line')
        .map((el) => el.textContent.trim())
    ).toEqual(['No plan', 'Enterprise', 'Payment due'])
    expect(screen.queryByText('Owner')).toBeNull()
    expect(screen.queryByText('Member')).toBeNull()
  })

  it('hides search at 5 workspaces', () => {
    renderComponent({ activeWorkspaceId: 'ws-0', workspaces: teams(5) })

    expect(screen.queryByTestId('workspace-switcher-search')).toBeNull()
  })

  it('shows search at 6 workspaces and filters by name', async () => {
    renderComponent({ activeWorkspaceId: 'ws-0', workspaces: teams(6) })

    await userEvent.type(
      screen.getByTestId('workspace-switcher-search'),
      'team 3'
    )

    expect(screen.getByText('Team 3')).toBeInTheDocument()
    expect(screen.queryByText('Team 4')).toBeNull()
  })

  it('shows the no-results message when nothing matches', async () => {
    renderComponent({ activeWorkspaceId: 'ws-0', workspaces: teams(6) })

    await userEvent.type(
      screen.getByTestId('workspace-switcher-search'),
      'marketing'
    )

    expect(
      screen.getByText('No workspaces match “marketing”.')
    ).toBeInTheDocument()
    expect(screen.queryByText('Team 0')).toBeNull()
  })

  it('shows the error state with Try again and keeps Create workspace available', async () => {
    const store = useTeamWorkspaceStore()
    const initialize = vi
      .spyOn(store, 'initialize')
      .mockRejectedValue(new Error('list failed'))
    store.$patch({ initState: 'error' })
    renderComponent({ workspaces: [] })

    expect(
      screen.getByText('Couldn’t load your workspaces.')
    ).toBeInTheDocument()
    expect(screen.getByTestId('workspace-switcher-create')).toBeEnabled()

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(initialize).toHaveBeenCalledOnce()
    await vi.waitFor(() => expect(reportError).toHaveBeenCalled())
  })

  it('shows the served owned-workspace limit under a disabled Create workspace', async () => {
    useTeamWorkspaceStore().$patch({
      serverRefusesCreation: true,
      creationDeniedReason: 'owned_workspace_limit',
      maxOwnedWorkspaces: 10
    })
    const { emitted } = renderComponent()

    expect(screen.getByText('You can own up to 10.')).toBeInTheDocument()
    const create = screen.getByTestId('workspace-switcher-create')
    expect(create).toBeDisabled()
    await userEvent.click(create)
    expect(emitted().create).toBeUndefined()
  })

  it('shows no limit line when creation is allowed', () => {
    renderComponent()

    expect(screen.getByText('Create workspace')).toBeInTheDocument()
    expect(screen.queryByTestId('workspace-switcher-create-refusal')).toBeNull()
  })
})

describe('WorkspaceSwitcherPopover with billing_new_ux_enabled off', () => {
  beforeEach(() => {
    vi.mocked(useFeatureFlags().flags).billingNewUxEnabled = false
    const billingContext = useBillingContext()
    billingContext.subscription = computed(() => null)
    vi.mocked(useBillingContext).mockReturnValue(billingContext)
    distributionMocks.isCloud = true
  })

  it('keeps the previous switcher: role line, tier badge, no search, old create label', () => {
    renderComponent({
      activeWorkspaceId: 'ws-team',
      workspaces: [
        createWorkspaceState({
          id: 'ws-personal',
          name: 'Personal Workspace',
          type: 'personal',
          role: 'owner',
          subscription_tier: 'PRO',
          plan_summary: { status: 'paused', plan_name: 'Pro' }
        }),
        ...Array.from({ length: 6 }, (_, i) =>
          createWorkspaceState({
            id: `ws-${i}`,
            name: `Team ${i}`,
            type: 'team',
            role: 'member',
            plan_summary: { status: 'active', plan_name: 'Enterprise' }
          })
        )
      ]
    })

    expect(screen.getByText('Pro')).toBeInTheDocument()
    expect(screen.getByText('Owner')).toBeInTheDocument()
    expect(screen.queryByText('Paused')).toBeNull()
    expect(screen.queryByText('Enterprise')).toBeNull()
    expect(screen.queryByTestId('workspace-switcher-search')).toBeNull()
    expect(screen.getByText('Create a team workspace')).toBeInTheDocument()
  })
})
