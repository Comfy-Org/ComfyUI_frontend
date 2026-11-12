import type { WorkspacePlanSummary } from '@comfyorg/ingest-types'
import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { getActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
        WorkspaceSwitcherPopover: WorkspaceSwitcherPopoverStub,
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

    it.for([
      { name: 'Credits', testId: 'credits-menu-item' },
      { name: 'Workspace settings', testId: 'workspace-settings-menu-item' }
    ])(
      'opens Settings › Billing from $name and closes the menu',
      async ({ testId }) => {
        const user = userEvent.setup()
        const { closed } = renderMenu()

        await user.click(screen.getByTestId(testId))

        expect(useSettingsDialog().show).toHaveBeenCalledWith('workspace')
        expect(closed).toHaveBeenCalledOnce()
      }
    )
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
