import userEvent from '@testing-library/user-event'
import { screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useTelemetry } from '@comfyorg/telemetry'
import { useWorkspaceDialogs } from '@/platform/account/composables/useWorkspaceDialogs'
import { mockBillingContext } from '@/utils/__tests__/mockBillingContext'

import {
  personalWorkspace,
  seedWorkspaces,
  studioWorkspace,
  workspaceState
} from '@/workbench/extensions/agent/composables/agent/agentWorkspaceTestSetup'
import AccountWorkspaceGroup from './AccountWorkspaceGroup.vue'
import { renderInOpenMenu } from './accountSubmenuTestSetup'

const distribution = vi.hoisted(() => ({ isCloud: true }))

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/platform/billing/composables/useBillingContext'))
vi.mock(import('@/platform/distribution/types'), () => distribution)
vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/platform/account/composables/useAccountUI'))
vi.mock(import('@/platform/account/composables/useWorkspaceDialogs'))

function expectTracked(buttonId: string): void {
  expect(useTelemetry()?.trackUiButtonClicked).toHaveBeenCalledWith({
    button_id: buttonId,
    element_group: 'agent_account_menu'
  })
}

function workspaceItem(name: string): HTMLElement {
  return screen.getByRole('menuitemradio', { name: new RegExp(`^${name}`) })
}

describe('AccountWorkspaceGroup', () => {
  beforeEach(() => {
    distribution.isCloud = true
  })

  it('labels the group and checks the current workspace', async () => {
    seedWorkspaces()
    await renderInOpenMenu(AccountWorkspaceGroup)

    expect(screen.getByText('Workspaces')).toBeVisible()
    expect(workspaceItem('Personal Workspace')).toBeChecked()
    expect(workspaceItem('Studio')).not.toBeChecked()
  })

  it.for([
    {
      scenario: 'the current personal workspace on the billed plan',
      activeWorkspaceId: personalWorkspace.id,
      name: 'Personal Workspace',
      expected: 'Personal Workspace Owner · Pro'
    },
    {
      scenario: 'another personal workspace on its own plan',
      activeWorkspaceId: studioWorkspace.id,
      name: 'Personal Workspace',
      expected: 'Personal Workspace Owner · Creator'
    },
    {
      scenario: 'a team workspace by role alone',
      activeWorkspaceId: studioWorkspace.id,
      name: 'Studio',
      expected: 'Studio Member'
    }
  ])(
    'describes $scenario as "$expected"',
    async ({ activeWorkspaceId, name, expected }) => {
      mockBillingContext().tier = computed(() => 'PRO' as const)
      seedWorkspaces({
        activeWorkspaceId,
        workspaces: [
          workspaceState({
            ...personalWorkspace,
            subscription_tier: 'CREATOR'
          }),
          studioWorkspace
        ]
      })
      await renderInOpenMenu(AccountWorkspaceGroup)

      expect(workspaceItem(name)).toHaveAccessibleName(expected)
    }
  )

  it('switches to the chosen workspace and records it', async () => {
    const store = seedWorkspaces()
    await renderInOpenMenu(AccountWorkspaceGroup)

    await userEvent.click(workspaceItem('Studio'))

    expect(store.switchWorkspace).toHaveBeenCalledExactlyOnceWith('ws-studio')
    expectTracked('agent_account_menu_workspace_switched')
  })

  it('stays put when the current workspace is chosen again', async () => {
    const store = seedWorkspaces()
    await renderInOpenMenu(AccountWorkspaceGroup)

    await userEvent.click(workspaceItem('Personal Workspace'))

    expect(store.switchWorkspace).not.toHaveBeenCalled()
    expect(useTelemetry()?.trackUiButtonClicked).not.toHaveBeenCalled()
  })

  it('starts creating a workspace', async () => {
    seedWorkspaces()
    await renderInOpenMenu(AccountWorkspaceGroup)

    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Create workspace' })
    )

    expect(
      useWorkspaceDialogs().showCreateWorkspaceDialog
    ).toHaveBeenCalledOnce()
    expectTracked('agent_account_menu_workspace_create_clicked')
  })

  it('leaves Create workspace out when the server refuses creation', async () => {
    seedWorkspaces().$patch({ serverRefusesCreation: true })
    await renderInOpenMenu(AccountWorkspaceGroup)

    expect(screen.getAllByRole('menuitemradio')).toHaveLength(2)
    expect(
      screen.queryByRole('menuitem', { name: 'Create workspace' })
    ).not.toBeInTheDocument()
  })

  it.for([
    { scenario: 'outside cloud', isCloud: false, initState: 'ready' },
    {
      scenario: 'before the workspaces load',
      isCloud: true,
      initState: 'loading'
    },
    {
      scenario: 'on an API key session',
      isCloud: true,
      initState: 'ready',
      isApiKeyLogin: true
    }
  ] as const)(
    'is absent $scenario',
    async ({ isCloud, initState, isApiKeyLogin = false }) => {
      distribution.isCloud = isCloud
      useCurrentUser().isApiKeyLogin = computed(() => isApiKeyLogin)
      seedWorkspaces({ initState })
      await renderInOpenMenu(AccountWorkspaceGroup)

      expect(screen.getByRole('menu')).toHaveTextContent(/^$/)
    }
  )
})
