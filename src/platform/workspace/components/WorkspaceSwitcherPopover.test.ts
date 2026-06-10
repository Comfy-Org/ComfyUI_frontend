import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import WorkspaceSwitcherPopover from './WorkspaceSwitcherPopover.vue'

vi.mock('@/platform/workspace/composables/useWorkspaceSwitch', () => ({
  useWorkspaceSwitch: () => ({ switchWorkspace: vi.fn() })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({ subscription: ref(null) })
}))

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
        createWorkspace: 'Create new workspace',
        maxWorkspacesReached:
          'You can only own 10 workspaces. Delete one to create a new one.'
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

function renderComponent() {
  return render(WorkspaceSwitcherPopover, {
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          initialState: {
            teamWorkspace: {
              activeWorkspaceId: 'ws-personal',
              isFetchingWorkspaces: false,
              workspaces: [
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
  it('exposes the full team workspace name as a tooltip on the row', () => {
    renderComponent()

    const name = screen.getByText(LONG_WORKSPACE_NAME)

    expect(name).toHaveAttribute('title', LONG_WORKSPACE_NAME)
  })
})
