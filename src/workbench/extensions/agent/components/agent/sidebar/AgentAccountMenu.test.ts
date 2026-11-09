import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { i18n } from '@/i18n'
import { useSubscriptionDialog } from '@/platform/billing/subscription/composables/useSubscriptionDialog'
import { KeybindingImpl } from '@comfyorg/keybindings/keybinding'
import { useKeybindingStore } from '@comfyorg/keybindings/keybindingStore'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useTelemetry } from '@comfyorg/telemetry'
import { useAccountUI } from '@/platform/account/composables/useAccountUI'
import { useCommandStore } from '@/platform/keybindings/commandStore'
import { mockBillingContext } from '@/utils/__tests__/mockBillingContext'

import { seedWorkspaces } from '@/workbench/extensions/agent/composables/agent/agentWorkspaceTestSetup'
import AgentAccountMenu from './AgentAccountMenu.vue'

const distribution = vi.hoisted(() => ({ isCloud: true }))

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/platform/billing/composables/useBillingContext'))
vi.mock(
  import('@/platform/billing/subscription/composables/useSubscriptionDialog')
)
vi.mock(import('@/platform/distribution/types'), () => distribution)
vi.mock(import('@/platform/settings/composables/useSettingsDialog'))
vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/platform/account/composables/useAccountUI'))
vi.mock(import('@/platform/workspace/utils/platformLink'), () => ({
  platformLink: (path) => `https://platform.test${path}`
}))
vi.mock(import('@/services/dialogService'))

function signIn(
  account: { displayName?: string } = { displayName: 'Marwan Mostafa' }
): void {
  const user = useCurrentUser()
  user.isLoggedIn = computed(() => true)
  user.userDisplayName = computed(() => account.displayName)
  user.userEmail = computed(() => 'marwan@example.com')
}

function mount(props: ComponentProps<typeof AgentAccountMenu> = {}) {
  return render(AgentAccountMenu, { props, global: { plugins: [i18n] } })
}

function trigger(): HTMLElement {
  return screen.getByRole('button', { name: 'Account menu' })
}

async function openMenu(): Promise<HTMLElement> {
  await userEvent.click(trigger())
  return screen.getByRole('menu')
}

function expectEntries(menu: HTMLElement, labels: string[]): void {
  const items = [
    ...within(menu).queryAllByRole('menuitemradio'),
    ...within(menu).getAllByRole('menuitem')
  ].sort((a, b) =>
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
  )
  expect(items).toHaveLength(labels.length)
  labels.forEach((label, index) => {
    expect(items[index]).toHaveAccessibleName(new RegExp(`^${label}`))
  })
}

function expectTracked(buttonId: string): void {
  expect(useTelemetry()?.trackUiButtonClicked).toHaveBeenCalledWith({
    button_id: buttonId,
    element_group: 'agent_account_menu'
  })
}

describe('AgentAccountMenu', () => {
  beforeEach(() => {
    distribution.isCloud = true
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    )
    vi.spyOn(window, 'open').mockReturnValue(null)
    vi.mocked(useCommandStore().execute).mockResolvedValue(undefined)
  })

  it.for([
    { displayName: 'Marwan Mostafa', tier: 'PRO', expected: /Marwan · Pro$/ },
    { displayName: 'Marwan Mostafa', tier: null, expected: /Marwan$/ },
    { displayName: undefined, tier: null, expected: /Account$/ }
  ] as const)(
    'labels the trigger for "$displayName" on the $tier tier',
    ({ displayName, tier, expected }) => {
      signIn({ displayName })
      mockBillingContext().tier = computed(() => tier)
      mount()

      expect(trigger()).toHaveTextContent(expected)
    }
  )

  it.for([
    { tier: 'PRO', expected: /Personal Workspace\s*Pro$/ },
    { tier: null, expected: /Personal Workspace$/ }
  ] as const)(
    'labels the trigger with the workspace on the $tier tier',
    ({ tier, expected }) => {
      signIn()
      seedWorkspaces()
      mockBillingContext().tier = computed(() => tier)
      mount()

      expect(trigger()).toHaveTextContent(expected)
      expect(trigger()).not.toHaveTextContent('Marwan')
    }
  )

  it.for([
    { scenario: 'the initials', hasWorkspaces: false, expected: /^MM$/ },
    { scenario: 'the workspace letter', hasWorkspaces: true, expected: /^P$/ }
  ])('shows only $scenario when compact', ({ hasWorkspaces, expected }) => {
    signIn()
    if (hasWorkspaces) seedWorkspaces()
    mockBillingContext().tier = computed(() => 'PRO' as const)
    mount({ compact: true })

    expect(trigger()).toHaveTextContent(expected)
  })

  it.for([
    {
      scenario: 'signed in on cloud with workspaces',
      signedIn: true,
      isCloud: true,
      hasWorkspaces: true,
      entries: [
        'Personal Workspace',
        'Studio',
        'Create workspace',
        'Workspace settings',
        'Usage',
        'View all plans',
        'Settings',
        'Language',
        'Get help',
        'Get API Key',
        'Log out'
      ],
      separators: 3
    },
    {
      scenario: 'signed in on cloud before the workspaces load',
      signedIn: true,
      isCloud: true,
      entries: [
        'Workspace settings',
        'Usage',
        'View all plans',
        'Settings',
        'Language',
        'Get help',
        'Get API Key',
        'Log out'
      ],
      separators: 2
    },
    {
      scenario: 'signed in outside cloud with workspaces',
      signedIn: true,
      isCloud: false,
      hasWorkspaces: true,
      entries: [
        'Personal Workspace',
        'Studio',
        'Create workspace',
        'Workspace settings',
        'Usage',
        'View all plans',
        'Settings',
        'Language',
        'Get help',
        'Get API Key',
        'Log out'
      ],
      separators: 3
    },
    {
      scenario: 'signed out on cloud',
      signedIn: false,
      isCloud: true,
      entries: [
        'View all plans',
        'Settings',
        'Language',
        'Get help',
        'Get API Key'
      ],
      separators: 2
    },
    {
      scenario: 'signed out outside cloud',
      signedIn: false,
      isCloud: false,
      entries: [
        'View all plans',
        'Settings',
        'Language',
        'Get help',
        'Get API Key'
      ],
      separators: 2
    }
  ])(
    'lists the entries and separates the groups when $scenario',
    async ({
      signedIn,
      isCloud,
      hasWorkspaces = false,
      entries,
      separators
    }) => {
      if (signedIn) signIn()
      if (hasWorkspaces) seedWorkspaces()
      distribution.isCloud = isCloud
      mount()
      const menu = await openMenu()

      expectEntries(menu, entries)
      expect(within(menu).getAllByRole('separator')).toHaveLength(separators)
    }
  )

  it('opens below the trigger', async () => {
    mount()

    expect(await openMenu()).toHaveAttribute('data-side', 'bottom')
  })

  it('switches workspace from the menu', async () => {
    signIn()
    const store = seedWorkspaces()
    mount()
    await openMenu()

    await userEvent.click(
      screen.getByRole('menuitemradio', { name: /^Studio/ })
    )

    expect(store.switchWorkspace).toHaveBeenCalledExactlyOnceWith('ws-studio')
    expectTracked('agent_account_menu_workspace_switched')
  })

  it('hides the plans when the pricing surface is not available', async () => {
    signIn()
    useAccountUI().canOpenPricingSurface = computed(() => false)
    mount()
    const menu = await openMenu()

    expect(
      within(menu).queryByRole('menuitem', { name: 'View all plans' })
    ).not.toBeInTheDocument()
    expect(within(menu).getAllByRole('separator')).toHaveLength(2)
  })

  it('heads the account entries with the email', async () => {
    signIn()
    mount()
    const menu = await openMenu()
    const email = within(menu).getByText('marwan@example.com')

    expect(email).toBeVisible()
    expect(
      within(menu)
        .getByRole('menuitem', { name: /^Usage/ })
        .compareDocumentPosition(email)
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(
      email.compareDocumentPosition(
        within(menu).getByRole('menuitem', { name: 'Settings' })
      )
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it.for([
    {
      label: 'Workspace settings',
      buttonId: 'agent_account_menu_workspace_settings_clicked',
      expectAction: () =>
        expect(useSettingsDialog().show).toHaveBeenCalledExactlyOnceWith(
          'workspace'
        )
    },
    {
      label: 'Settings',
      buttonId: 'agent_account_menu_settings_clicked',
      expectAction: () =>
        expect(useCommandStore().execute).toHaveBeenCalledWith(
          'Comfy.ShowSettingsDialog'
        )
    },
    {
      label: 'Usage',
      buttonId: 'agent_account_menu_usage_clicked',
      expectAction: () =>
        expect(useSettingsDialog().show).toHaveBeenCalledWith(
          'workspace',
          undefined,
          { planCreditsView: 'overview' }
        )
    },
    {
      label: 'Get help',
      buttonId: 'agent_account_menu_help_clicked',
      expectAction: () =>
        expect(useCommandStore().execute).toHaveBeenCalledWith(
          'Comfy.ContactSupport'
        )
    },
    {
      label: 'View all plans',
      buttonId: 'agent_account_menu_plans_clicked',
      expectAction: () =>
        expect(useSubscriptionDialog().showPricingTable).toHaveBeenCalledWith({
          reason: 'avatar_menu_plans'
        })
    },
    {
      label: 'Get API Key',
      buttonId: 'agent_account_menu_api_key_clicked',
      expectAction: () =>
        expect(window.open).toHaveBeenCalledWith(
          'https://platform.test/profile/api-keys',
          '_blank',
          'noopener,noreferrer'
        )
    },
    {
      label: 'Log out',
      buttonId: 'agent_account_menu_logout_clicked',
      expectAction: () =>
        expect(useCurrentUser().handleSignOut).toHaveBeenCalledOnce()
    }
  ])(
    'runs "$label" and records $buttonId',
    async ({ label, buttonId, expectAction }) => {
      signIn()
      mount()
      await openMenu()

      await userEvent.click(
        screen.getByRole('menuitem', { name: new RegExp(`^${label}`) })
      )

      expectAction()
      expectTracked(buttonId)
    }
  )

  it('says where the API key entry leads and that it opens a new tab', async () => {
    mount()
    await openMenu()
    const apiKey = screen.getByRole('menuitem', { name: /^Get API Key/ })

    expect(within(apiKey).getByText('on Comfy Platform')).toBeVisible()
    expect(within(apiKey).getByText('Opens in a new tab')).toBeInTheDocument()
  })

  it('shows the Settings shortcut and exposes it to assistive tech', async () => {
    useKeybindingStore().addDefaultKeybinding(
      new KeybindingImpl({
        commandId: 'Comfy.ShowSettingsDialog',
        combo: { key: ',', ctrl: true }
      })
    )
    mount()
    await openMenu()
    const settings = screen.getByRole('menuitem', { name: 'Settings' })

    expect(within(settings).getByText('Ctrl + ,')).toBeVisible()
    expect(settings).toHaveAttribute('aria-keyshortcuts', 'Control+,')
  })

  it('leaves the shortcut out when Settings has no key binding', async () => {
    mount()
    await openMenu()

    expect(
      screen.getByRole('menuitem', { name: 'Settings' })
    ).not.toHaveAttribute('aria-keyshortcuts')
  })

  it('refreshes the balance and records the open when the menu opens', async () => {
    signIn()
    const billing = mockBillingContext()
    mount()

    expect(billing.fetchBalance).not.toHaveBeenCalled()
    await openMenu()

    expect(billing.fetchBalance).toHaveBeenCalledOnce()
    expectTracked('agent_account_menu_opened')
  })

  it('shows the credit balance beside Usage', async () => {
    signIn()
    mockBillingContext().balance = computed(() => ({
      amountMicros: 100,
      currency: 'USD'
    }))
    mount()
    await openMenu()
    const usage = screen.getByRole('menuitem', {
      name: 'Usage Credit balance: 211'
    })

    expect(within(usage).getByText('211')).toBeVisible()
  })

  it('shows a placeholder while the balance loads', async () => {
    signIn()
    const billing = mockBillingContext()
    billing.isLoading = ref(true)
    billing.balance = computed(() => ({ amountMicros: 100, currency: 'USD' }))
    mount()
    await openMenu()
    const usage = screen.getByRole('menuitem', { name: 'Usage' })

    expect(
      within(usage).getByTestId('agent-account-balance-loading')
    ).toBeVisible()
    expect(within(usage).queryByText('211')).not.toBeInTheDocument()
  })
})
