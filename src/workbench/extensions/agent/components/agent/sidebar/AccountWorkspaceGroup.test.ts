import userEvent from '@testing-library/user-event'
import { screen } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import type { DesktopHostAuthBridge } from '@/platform/auth/desktopHost/desktopHostAuthBridge'
import {
  startDesktopHostSession,
  stopDesktopHostSession
} from '@/platform/auth/desktopHost/desktopHostSession'
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

const SCOPE_CAPTION = 'Workspaces only affect which credits you use.'

function expectTracked(buttonId: string): void {
  expect(useTelemetry()?.trackUiButtonClicked).toHaveBeenCalledWith({
    button_id: buttonId,
    element_group: 'agent_account_menu'
  })
}

function workspaceItem(name: string): HTMLElement {
  return screen.getByRole('menuitemradio', { name: new RegExp(`^${name}`) })
}

function createWorkspaceItem(): HTMLElement | null {
  return screen.queryByRole('menuitem', { name: 'Create workspace' })
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

  it('holds the workspaces while a switch is in flight', async () => {
    const store = seedWorkspaces()
    store.$patch({ isSwitching: true })
    await renderInOpenMenu(AccountWorkspaceGroup)

    await userEvent.click(workspaceItem('Studio'))

    expect(workspaceItem('Studio')).toHaveAttribute('aria-disabled', 'true')
    expect(store.switchWorkspace).not.toHaveBeenCalled()
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
    expect(createWorkspaceItem()).not.toBeInTheDocument()
  })

  it.for([
    {
      distribution: 'on Cloud',
      isCloud: true,
      offersCreate: true,
      showsCaption: false
    },
    {
      distribution: 'off Cloud',
      isCloud: false,
      offersCreate: false,
      showsCaption: true
    }
  ])(
    '$distribution offers Create workspace: $offersCreate and explains the scope: $showsCaption',
    async ({ isCloud, offersCreate, showsCaption }) => {
      distribution.isCloud = isCloud
      seedWorkspaces()
      await renderInOpenMenu(AccountWorkspaceGroup)

      expect(screen.getAllByRole('menuitemradio')).toHaveLength(2)
      expect(createWorkspaceItem() !== null).toBe(offersCreate)
      expect(screen.queryByText(SCOPE_CAPTION) !== null).toBe(showsCaption)
    }
  )

  describe('with a Desktop host session', () => {
    const signedIn = {
      status: 'signed_in',
      userId: 'host-user',
      workspaceId: personalWorkspace.id
    } as const
    const hostBridge = (canSwitch: boolean): DesktopHostAuthBridge => ({
      getState: async () => signedIn,
      getWorkspaceToken: async () => 'host-token',
      requestSignIn: async () => signedIn,
      signOut: async () => ({ status: 'signed_out' }),
      ...(canSwitch && { switchWorkspace: async () => signedIn }),
      onChanged: () => () => {}
    })

    afterEach(() => stopDesktopHostSession())

    it.for([
      {
        scenario: 'offers the switcher when Desktop can switch',
        canSwitch: true,
        radios: 2
      },
      {
        scenario: 'pins the current workspace on an older Desktop',
        canSwitch: false,
        radios: 0
      }
    ])('$scenario', async ({ canSwitch, radios }) => {
      distribution.isCloud = false
      seedWorkspaces()
      await startDesktopHostSession(hostBridge(canSwitch))
      await renderInOpenMenu(AccountWorkspaceGroup)

      expect(screen.queryAllByRole('menuitemradio')).toHaveLength(radios)
      expect(screen.getByText('Personal Workspace')).toBeVisible()
      expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
    })
  })

  it.for([
    { scenario: 'before the workspaces load', initState: 'loading' },
    {
      scenario: 'on an API key session',
      initState: 'ready',
      isApiKeyLogin: true
    }
  ] as const)(
    'is absent $scenario',
    async ({ initState, isApiKeyLogin = false }) => {
      useCurrentUser().isApiKeyLogin = computed(() => isApiKeyLogin)
      seedWorkspaces({ initState })
      await renderInOpenMenu(AccountWorkspaceGroup)

      expect(screen.getByRole('menu')).toHaveTextContent(/^$/)
    }
  )
})
