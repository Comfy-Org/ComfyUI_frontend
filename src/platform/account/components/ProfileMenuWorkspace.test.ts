import type { WorkspacePlanSummary } from '@comfyorg/ingest-types'
import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { getActivePinia } from 'pinia'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { computed, defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { reportError } from '@comfyorg/telemetry/reportError'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import enMessages from '@/locales/en/main.json'
import { useWorkspaceDialogs } from '@/platform/account/composables/useWorkspaceDialogs'
import type { DesktopHostAuthBridge } from '@/platform/auth/desktopHost/desktopHostAuthBridge'
import {
  startDesktopHostSession,
  stopDesktopHostSession
} from '@/platform/auth/desktopHost/desktopHostSession'
import type { BalanceInfo } from '@/platform/billing/composables/types'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import ProfileMenuWorkspace from '@/platform/account/components/ProfileMenuWorkspace.vue'

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/platform/billing/composables/useBillingContext'))
vi.mock(import('@/platform/settings/composables/useSettingsDialog'))
vi.mock(import('@/platform/account/composables/useWorkspaceDialogs'))
vi.mock(import('@comfyorg/telemetry'))

const WorkspaceSwitcherFlyoutStub = defineComponent({
  emits: ['select', 'create'],
  template: `
    <div>
      <button data-testid="stub-select-workspace" @click="$emit('select')" />
      <button data-testid="stub-create-workspace" @click="$emit('create')" />
    </div>
  `
})

const ProfileMenuCreditsFlyoutStub = defineComponent({
  emits: ['openBilling'],
  template: `
    <div data-testid="credits-flyout">
      <button>Add credits</button>
      <button data-testid="stub-open-billing" @click="$emit('openBilling')">
        Billing settings
      </button>
    </div>
  `
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

type Served = {
  role: 'owner' | 'member'
  planSummary?: WorkspacePlanSummary
  balance: BalanceInfo | null
  loading: boolean
  accountActionsOnly: boolean
}

const defaults: Served = {
  role: 'owner',
  planSummary: { status: 'active', plan_name: 'Pro' },
  balance: { amountMicros: 4_945_000, currency: 'USD' },
  loading: false,
  accountActionsOnly: false
}

function renderMenu(served: Partial<Served> = {}) {
  const { role, planSummary, balance, loading, accountActionsOnly } = {
    ...defaults,
    ...served
  }
  const store = useTeamWorkspaceStore()
  store.initState = 'ready'
  Object.assign(store, {
    workspaceName: 'Comfy Team',
    activeWorkspace: {
      id: 'ws-1',
      name: 'Comfy Team',
      type: 'team',
      role,
      created_at: '2026-01-01T00:00:00Z',
      joined_at: '2026-01-01T00:00:00Z',
      ...(planSummary && { plan_summary: planSummary })
    }
  })
  const billing = useBillingContext()
  billing.balance = computed(() => balance)
  billing.isLoading = ref(loading)

  const emitted = vi.fn()
  render(ProfileMenuWorkspace, {
    props: { accountActionsOnly, onClose: emitted },
    global: {
      plugins: [getActivePinia()!, i18n],
      stubs: {
        WorkspaceSwitcherFlyout: WorkspaceSwitcherFlyoutStub,
        ProfileMenuCreditsFlyout: ProfileMenuCreditsFlyoutStub,
        WorkspaceProfilePic: true
      }
    }
  })
  return { closed: emitted }
}

describe('ProfileMenuWorkspace', () => {
  beforeEach(() => {
    useCurrentUser().userDisplayName = computed(() => 'Mariana Martinho')
    useCurrentUser().userEmail = computed(() => 'mariana@comfy.org')
    vi.mocked(useBillingContext).mockReturnValue(useBillingContext())
  })

  describe('the plan line under the workspace name', () => {
    it.for<{ name: string; served: Partial<Served>; line: string }>([
      { name: 'an active plan', served: {}, line: 'Pro • Owner' },
      {
        name: 'a member of an active plan',
        served: { role: 'member' },
        line: 'Pro • Member'
      },
      {
        name: 'no plan',
        served: { planSummary: { status: 'no_plan', plan_name: null } },
        line: 'No plan • Owner'
      },
      {
        name: 'a paused plan',
        served: { planSummary: { status: 'paused', plan_name: 'Pro' } },
        line: 'Paused • Owner'
      },
      {
        name: 'a renewal payment due',
        served: { planSummary: { status: 'payment_due', plan_name: 'Pro' } },
        line: 'Payment due • Owner'
      },
      {
        name: 'an ended plan',
        served: { planSummary: { status: 'ended', plan_name: 'Pro' } },
        line: 'Plan ended • Owner'
      },
      {
        name: 'an active plan whose name is unknown',
        served: { planSummary: { status: 'active', plan_name: null } },
        line: 'Owner'
      },
      {
        name: 'no served summary',
        served: { planSummary: undefined },
        line: 'Owner'
      }
    ])('shows "$line" for $name', ({ served, line }) => {
      renderMenu(served)

      expect(screen.getByTestId('workspace-plan-line')).toHaveTextContent(line)
    })
  })

  describe('the Credits row', () => {
    it('shows the effective balance, keeping a negative sign', () => {
      renderMenu({
        balance: {
          amountMicros: 100,
          effectiveBalanceMicros: -2_110,
          currency: 'USD'
        }
      })

      expect(screen.getByTestId('credits-balance')).toHaveTextContent('-')
      expect(
        screen.queryByTestId('credits-balance-unavailable')
      ).not.toBeInTheDocument()
    })

    it('shows a muted dash with the reason when the balance could not be read', async () => {
      const user = userEvent.setup()
      renderMenu({ balance: null })

      const dash = screen.getByTestId('credits-balance-unavailable')
      expect(dash).toHaveTextContent('—')
      await user.hover(dash)
      expect(await screen.findByTestId('tooltip-content')).toHaveTextContent(
        "Couldn't load your balance."
      )
    })

    it('shows no number while the balance loads', () => {
      renderMenu({ loading: true })

      expect(screen.queryByTestId('credits-balance')).not.toBeInTheDocument()
      expect(
        screen.queryByTestId('credits-balance-unavailable')
      ).not.toBeInTheDocument()
    })

    it('opens Settings › Billing from Workspace settings and closes the menu', async () => {
      const user = userEvent.setup()
      const { closed } = renderMenu()

      await user.click(screen.getByTestId('workspace-settings-menu-item'))

      expect(useSettingsDialog().show).toHaveBeenCalledWith('workspace')
      expect(closed).toHaveBeenCalledOnce()
    })
  })

  describe('the credits flyout opened from the Credits row', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      onTestFinished(() => {
        vi.useRealTimers()
      })
    })

    const settleHoverTimers = () => vi.advanceTimersByTimeAsync(1000)

    function setup() {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const menu = renderMenu()
      const credits = screen.getByTestId('credits-menu-item')
      async function leaveCredits() {
        await user.unhover(credits)
        credits.blur()
        await settleHoverTimers()
      }
      return { user, credits, leaveCredits, ...menu }
    }

    it.for<{
      name: string
      open: (user: UserEvent, row: HTMLElement) => Promise<void>
    }>([
      { name: 'a click', open: (user, row) => user.click(row) },
      {
        name: 'Enter',
        open: async (user, row) => {
          row.focus()
          await user.keyboard('{Enter}')
        }
      },
      {
        name: 'ArrowRight',
        open: async (user, row) => {
          row.focus()
          await user.keyboard('{ArrowRight}')
        }
      }
    ])(
      'opens on $name and stays open after the pointer and focus leave',
      async ({ open }) => {
        const { user, credits, leaveCredits, closed } = setup()

        await open(user, credits)
        await leaveCredits()

        expect(screen.getByTestId('credits-flyout')).toBeInTheDocument()
        expect(credits).toHaveAttribute('aria-expanded', 'true')
        expect(useSettingsDialog().show).not.toHaveBeenCalled()
        expect(closed).not.toHaveBeenCalled()
      }
    )

    it.for<{ name: string; dismiss: (user: UserEvent) => Promise<void> }>([
      { name: 'Escape', dismiss: (user) => user.keyboard('{Escape}') },
      {
        name: 'a click outside it',
        dismiss: (user) =>
          user.click(screen.getByTestId('current-user-identity'))
      }
    ])('closes on $name', async ({ dismiss }) => {
      const { user, credits } = setup()
      await user.click(credits)
      await settleHoverTimers()

      await dismiss(user)

      expect(screen.queryByTestId('credits-flyout')).not.toBeInTheDocument()
      expect(credits).toHaveAttribute('aria-expanded', 'false')
    })

    it('stays open when the Credits row is clicked again', async () => {
      const { user, credits, leaveCredits } = setup()
      await user.click(credits)
      await settleHoverTimers()

      await user.click(credits)
      await leaveCredits()

      expect(screen.getByTestId('credits-flyout')).toBeInTheDocument()
    })

    it('closes when the workspace switcher opens, and stays closed after it closes', async () => {
      const { user, credits, leaveCredits } = setup()
      await user.click(credits)
      await settleHoverTimers()
      const switcher = screen.getByTestId('workspace-switcher-trigger')

      await user.click(switcher)
      expect(screen.getByTestId('workspace-switcher-panel')).toBeInTheDocument()
      expect(screen.queryByTestId('credits-flyout')).not.toBeInTheDocument()

      await user.click(switcher)
      await leaveCredits()
      expect(screen.queryByTestId('credits-flyout')).not.toBeInTheDocument()
    })

    it('closes the workspace switcher when it opens', async () => {
      const { user, credits } = setup()
      await user.click(screen.getByTestId('workspace-switcher-trigger'))
      await settleHoverTimers()

      await user.click(credits)

      expect(
        screen.queryByTestId('workspace-switcher-panel')
      ).not.toBeInTheDocument()
      expect(screen.getByTestId('credits-flyout')).toBeInTheDocument()
    })

    describe('opened from the keyboard', () => {
      const flyoutAction = (name: string) =>
        within(screen.getByTestId('credits-flyout')).getByRole('button', {
          name
        })

      it.for(['{Enter}', '{ArrowRight}'])(
        'moves focus to the first action on %s',
        async (key) => {
          const { user, credits } = setup()
          credits.focus()

          await user.keyboard(key)

          expect(flyoutAction('Add credits')).toHaveFocus()
        }
      )

      it('lets Tab reach every action and keeps focus inside the flyout', async () => {
        const { user, credits } = setup()
        credits.focus()
        await user.keyboard('{Enter}')
        const addCredits = flyoutAction('Add credits')
        const billingSettings = flyoutAction('Billing settings')

        await user.tab()
        expect(billingSettings).toHaveFocus()
        await user.tab()
        expect(addCredits).toHaveFocus()
      })

      it('opens the preview on the first fresh hover after Escape', async () => {
        const { user, credits } = setup()
        credits.focus()
        await user.keyboard('{Enter}')
        expect(
          screen.getByRole('dialog', { name: 'Credits' })
        ).toBeInTheDocument()
        await user.keyboard('{Escape}')
        await settleHoverTimers()
        expect(screen.queryByTestId('credits-flyout')).not.toBeInTheDocument()

        await user.hover(credits)
        await settleHoverTimers()

        expect(screen.getByTestId('credits-flyout')).toBeInTheDocument()
        expect(
          screen.queryByRole('dialog', { name: 'Credits' })
        ).not.toBeInTheDocument()
      })

      it('names the pinned flyout Credits for assistive technology', async () => {
        const { user, credits } = setup()
        credits.focus()
        await user.keyboard('{Enter}')

        expect(
          screen.getByRole('dialog', { name: 'Credits' })
        ).toBeInTheDocument()
      })

      it('moves focus back into the pinned flyout when Credits is pressed again', async () => {
        const { user, credits } = setup()
        credits.focus()
        await user.keyboard('{Enter}')
        credits.focus()
        await settleHoverTimers()
        expect(
          screen.getByRole('dialog', { name: 'Credits' })
        ).toBeInTheDocument()

        await user.keyboard('{Enter}')

        expect(flyoutAction('Add credits')).toHaveFocus()
      })

      it('closes on Escape and returns focus to the Credits row', async () => {
        const { user, credits } = setup()
        credits.focus()
        await user.keyboard('{Enter}')
        await user.tab()
        expect(flyoutAction('Billing settings')).toHaveFocus()

        await user.keyboard('{Escape}')
        await settleHoverTimers()

        expect(screen.queryByTestId('credits-flyout')).not.toBeInTheDocument()
        expect(credits).toHaveFocus()
        expect(credits).toHaveAttribute('aria-expanded', 'false')
      })
    })

    it('previews on hover and closes once the pointer moves on', async () => {
      const { user, credits } = setup()

      await user.hover(credits)
      await settleHoverTimers()
      expect(screen.getByTestId('credits-flyout')).toBeInTheDocument()

      const identity = screen.getByTestId('current-user-identity')
      await user.pointer([
        { target: identity, coords: { clientX: 0, clientY: 300 } },
        { target: identity, coords: { clientX: 0, clientY: 600 } }
      ])
      await settleHoverTimers()
      expect(screen.queryByTestId('credits-flyout')).not.toBeInTheDocument()
      expect(credits).toHaveAttribute('aria-expanded', 'false')
    })

    it('opens Settings › Billing from Billing settings and closes the menu', async () => {
      const { user, credits, closed } = setup()
      await user.click(credits)

      await user.click(screen.getByTestId('stub-open-billing'))

      expect(useSettingsDialog().show).toHaveBeenCalledWith('workspace')
      expect(closed).toHaveBeenCalledOnce()
    })
  })

  it('drops the actions the redesign removes', () => {
    renderMenu()

    for (const name of [
      'Add credits',
      'Subscribe',
      'Plans & pricing',
      'Manage plan',
      'Partner Nodes pricing'
    ]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
    expect(screen.queryByTestId('credits-info-button')).not.toBeInTheDocument()
  })

  it('shows the person with a monogram, name and email', () => {
    renderMenu()

    const identity = screen.getByTestId('current-user-identity')
    expect(within(identity).getByText('M')).toBeInTheDocument()
    expect(within(identity).getByText('Mariana Martinho')).toBeInTheDocument()
    expect(within(identity).getByText('mariana@comfy.org')).toBeInTheDocument()
  })

  it('toggles the workspace switcher from the header row', async () => {
    const user = userEvent.setup()
    renderMenu()
    const trigger = screen.getByTestId('workspace-switcher-trigger')

    await user.click(trigger)
    expect(screen.getByTestId('workspace-switcher-panel')).toBeInTheDocument()

    await user.click(trigger)
    expect(
      screen.queryByTestId('workspace-switcher-panel')
    ).not.toBeInTheDocument()
  })

  it('opens the credits flyout on hover', async () => {
    const user = userEvent.setup()
    renderMenu()

    await user.hover(screen.getByTestId('credits-menu-item'))

    expect(await screen.findByTestId('credits-flyout')).toBeInTheDocument()
  })

  it('opens the credits flyout at once when ArrowRight is pressed on the Credits row', async () => {
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderMenu()
    screen.getByTestId('credits-menu-item').focus()

    await user.keyboard('{ArrowRight}')

    expect(screen.getByTestId('credits-flyout')).toBeInTheDocument()
  })

  it('keeps the credits flyout closed while the workspace switcher is open', async () => {
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderMenu()
    await user.click(screen.getByTestId('workspace-switcher-trigger'))

    await user.hover(screen.getByTestId('credits-menu-item'))
    await vi.advanceTimersByTimeAsync(1000)

    expect(screen.getByTestId('workspace-switcher-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('credits-flyout')).not.toBeInTheDocument()
  })

  it('opens the create-workspace dialog and closes the menu on create', async () => {
    const user = userEvent.setup()
    const { closed } = renderMenu()

    await user.click(screen.getByTestId('workspace-switcher-trigger'))
    await user.click(screen.getByTestId('stub-create-workspace'))

    expect(useWorkspaceDialogs().showCreateWorkspaceDialog).toHaveBeenCalled()
    expect(closed).toHaveBeenCalledOnce()
  })

  it('reports a failed balance read once instead of leaving it unhandled', async () => {
    const failure = new Error('Balance temporarily unavailable')
    vi.mocked(useBillingContext().fetchBalance).mockRejectedValueOnce(failure)

    renderMenu()

    await vi.waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(failure, {
        surface: 'billing',
        errorType: 'error_refreshing_balance',
        level: 'warning'
      })
    )
    expect(reportError).toHaveBeenCalledOnce()
  })

  it('keeps account actions available without workspace context', () => {
    renderMenu({ accountActionsOnly: true })

    expect(screen.getByTestId('user-settings-menu-item')).toBeInTheDocument()
    expect(screen.getByTestId('logout-menu-item')).toBeInTheDocument()
    expect(
      screen.queryByTestId('workspace-switcher-trigger')
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('credits-menu-item')).not.toBeInTheDocument()
    expect(useBillingContext().fetchBalance).not.toHaveBeenCalled()
  })

  describe('with a Desktop host session', () => {
    const signedIn = {
      status: 'signed_in',
      userId: 'host-user',
      workspaceId: 'ws-1'
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
      { name: 'offers the switcher when Desktop can switch', canSwitch: true },
      { name: 'shows a fixed workspace on an older Desktop', canSwitch: false }
    ])('$name', async ({ canSwitch }) => {
      await startDesktopHostSession(hostBridge(canSwitch))
      renderMenu()

      expect(screen.queryByTestId('workspace-switcher-trigger') !== null).toBe(
        canSwitch
      )
      expect(screen.queryByTestId('workspace-context-row') !== null).toBe(
        !canSwitch
      )
    })
  })
})
