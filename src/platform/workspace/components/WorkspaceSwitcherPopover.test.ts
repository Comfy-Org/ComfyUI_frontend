import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import WorkspaceSwitcherPopover from './WorkspaceSwitcherPopover.vue'

vi.mock('@/platform/workspace/composables/useWorkspaceSwitch', () => ({
  useWorkspaceSwitch: () => ({ switchWorkspace: vi.fn() })
}))

const billingMocks = vi.hoisted(() => ({
  subscription: {
    value: null as { tier: string; duration: string } | null
  }
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({ subscription: billingMocks.subscription })
}))

const distributionMocks = vi.hoisted(() => ({ isCloud: true }))

vi.mock('@/platform/distribution/types', () => distributionMocks)

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
          'You can only own 10 workspaces. Delete one to create a new one.'
      },
      subscription: {
        tiers: {
          pro: { name: 'Pro' }
        }
      }
    }
  }
})

function createWorkspaceState(overrides: Record<string, unknown>) {
  return {
    created_at: '2026-01-01T00:00:00Z',
    joined_at: '2026-01-01T00:00:00Z',
    isSubscribed: false,
    subscriptionPlan: null,
    subscriptionTier: null,
    members: [],
    pendingInvites: [],
    ...overrides
  }
}

function renderComponent(
  overrides: {
    activeWorkspaceId?: string
    workspaces?: Record<string, unknown>[]
  } = {}
) {
  return render(WorkspaceSwitcherPopover, {
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          initialState: {
            teamWorkspace: {
              activeWorkspaceId: overrides.activeWorkspaceId ?? 'ws-personal',
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
            }
          }
        }),
        i18n
      ],
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
    billingMocks.subscription.value = null
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
      renderComponent({
        workspaces: [
          createWorkspaceState({
            id: `ws-${type}`,
            name: 'My Creative Workspace',
            type,
            role: 'owner',
            isSubscribed,
            subscriptionPlan,
            subscriptionTier
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
    billingMocks.subscription.value = { tier: 'PRO', duration: 'MONTHLY' }

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
          isSubscribed: true,
          subscriptionTier: 'PRO'
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
          isSubscribed: true,
          subscriptionTier: 'PRO'
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

  it('hides the create-workspace footer on non-cloud distributions', () => {
    distributionMocks.isCloud = false

    renderComponent()

    expect(screen.queryByText('Create a team workspace')).toBeNull()
    expect(screen.queryByText(/You can only own 10 workspaces/)).toBeNull()
  })
})
