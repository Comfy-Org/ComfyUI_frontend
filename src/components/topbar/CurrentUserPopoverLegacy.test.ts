import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useDialogService } from '@/services/dialogService'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { getActivePinia } from 'pinia'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { formatCreditsFromCents } from '@/base/credits/comfyCredits'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import type { BalanceInfo, SubscriptionInfo } from '@/composables/billing/types'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import CurrentUserPopoverLegacy from './CurrentUserPopoverLegacy.vue'

const mockShowSettingsDialog = vi.fn()

vi.mock(import('@/platform/settings/composables/useSettingsDialog'))

const originalWindowOpen = window.open
beforeEach(() => {
  vi.mocked(useSettingsDialog().show).mockImplementation(mockShowSettingsDialog)
  const billing = useBillingContext()
  Object.assign(billing, {
    canAccessSubscriptionFeatures: computed(
      () => mockCanAccessSubscriptionFeatures.value
    ),
    tier: computed(() => mockTier.value),
    subscription: computed(() => mockSubscription.value),
    balance: computed(() => mockBalance.value),
    isLoading: mockIsLoading,
    isTeamPlan: computed(() => mockIsTeamPlan.value)
  })
  vi.mocked(useBillingContext).mockReturnValue(billing)

  window.open = vi.fn()
})

afterAll(() => {
  window.open = originalWindowOpen
})

vi.mock(import('@/composables/auth/useCurrentUser'))

vi.mock(import('@/services/dialogService'))

function makeSubscription(
  overrides: Partial<SubscriptionInfo> = {}
): SubscriptionInfo {
  return {
    isActive: true,
    tier: 'CREATOR',
    duration: 'MONTHLY',
    planSlug: null,
    scheduledChange: null,
    renewalDate: null,
    endDate: null,
    isCancelled: false,
    hasFunds: true,
    ...overrides
  }
}

const mockCanAccessSubscriptionFeatures = ref(true)
const mockTier = ref<SubscriptionInfo['tier']>('CREATOR')
const mockSubscription = ref<SubscriptionInfo | null>(makeSubscription())
const mockBalance = ref<BalanceInfo | null>(null)
const mockIsLoading = ref(false)
const mockIsTeamPlan = ref(false)

vi.mock(import('@/composables/billing/useBillingContext'))

vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))

vi.mock(import('@/base/credits/comfyCredits'), () => ({
  formatCreditsFromCents: vi.fn(({ cents }) => (cents / 100).toString())
}))

vi.mock(import('@/platform/telemetry'))

describe('CurrentUserPopoverLegacy', () => {
  beforeEach(() => {
    useCurrentUser().userPhotoUrl = computed(
      () => 'https://example.com/avatar.jpg'
    )
    useCurrentUser().userDisplayName = computed(() => 'Test User')
    useCurrentUser().userEmail = computed(() => 'test@example.com')
    mockCanAccessSubscriptionFeatures.value = true
    mockTier.value = 'CREATOR'
    mockSubscription.value = makeSubscription()
    mockBalance.value = {
      amountMicros: 100_000,
      effectiveBalanceMicros: 100_000,
      currency: 'usd'
    }
    mockIsLoading.value = false
  })

  function renderComponent(teamWorkspaceState?: Record<string, unknown>) {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: enMessages }
    })
    const onClose = vi.fn()
    const user = userEvent.setup()

    if (teamWorkspaceState) {
      useTeamWorkspaceStore().$patch(teamWorkspaceState)
    }

    render(CurrentUserPopoverLegacy, {
      global: {
        plugins: [i18n, getActivePinia()!],
        stubs: {
          Divider: true
        }
      },
      props: {
        onClose
      }
    })

    return { user, onClose }
  }

  it('renders user information correctly', () => {
    renderComponent()

    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })

  it('fetches the balance through the billing facade on mount', () => {
    renderComponent()

    expect(useBillingContext().fetchBalance).toHaveBeenCalled()
  })

  describe('subscription tier badge', () => {
    it('renders the tier name derived from the facade tier', () => {
      renderComponent()

      expect(screen.getByText('Creator')).toBeInTheDocument()
    })

    it('renders the yearly tier name when the facade subscription is annual', () => {
      mockSubscription.value = makeSubscription({ duration: 'ANNUAL' })

      renderComponent()

      expect(screen.getByText('Creator Yearly')).toBeInTheDocument()
    })

    it('hides the badge when the facade reports no tier', () => {
      mockTier.value = null
      mockSubscription.value = null

      renderComponent()

      expect(screen.queryByText('Creator')).not.toBeInTheDocument()
    })
  })

  it('formats and displays the facade balance', () => {
    renderComponent()

    expect(formatCreditsFromCents).toHaveBeenCalledWith({
      cents: 100_000,
      locale: 'en',
      numberOptions: {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }
    })

    expect(screen.getByText('1000')).toBeInTheDocument()
  })

  it('shows a skeleton instead of the balance while billing is loading', () => {
    mockIsLoading.value = true

    renderComponent()

    expect(screen.queryByText('1000')).not.toBeInTheDocument()
  })

  it('renders logout menu item with correct text', () => {
    renderComponent()

    expect(screen.getByTestId('logout-menu-item')).toBeInTheDocument()
    expect(screen.getByText('Log Out')).toBeInTheDocument()
  })

  describe('credits help icon (FE-617)', () => {
    it('renders the credits help icon as an interactive button with the unified-credits tooltip as its accessible name', () => {
      renderComponent()

      const helpButton = screen.getByTestId('credits-info-button')
      expect(helpButton).toBeInTheDocument()
      expect(helpButton.tagName).toBe('BUTTON')
      expect(helpButton).toHaveAttribute(
        'aria-label',
        enMessages.credits.unified.tooltip
      )
    })
  })

  it('opens user settings and emits close event when settings item is clicked', async () => {
    const { user, onClose } = renderComponent()

    expect(screen.getByTestId('user-settings-menu-item')).toBeInTheDocument()

    await user.click(screen.getByTestId('user-settings-menu-item'))

    expect(mockShowSettingsDialog).toHaveBeenCalledWith('user')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls logout function and emits close event when logout item is clicked', async () => {
    const { user, onClose } = renderComponent()

    expect(screen.getByTestId('logout-menu-item')).toBeInTheDocument()

    await user.click(screen.getByTestId('logout-menu-item'))

    expect(useCurrentUser().handleSignOut).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('opens API pricing docs and emits close event when partner nodes item is clicked', async () => {
    const { user, onClose } = renderComponent()

    expect(screen.getByTestId('partner-nodes-menu-item')).toBeInTheDocument()

    await user.click(screen.getByTestId('partner-nodes-menu-item'))

    expect(window.open).toHaveBeenCalledWith(
      'https://docs.comfy.org/tutorials/partner-nodes/pricing',
      '_blank'
    )
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('opens top-up dialog and emits close event when top-up button is clicked', async () => {
    const { user, onClose } = renderComponent()

    expect(screen.getByTestId('add-credits-button')).toBeInTheDocument()

    await user.click(screen.getByTestId('add-credits-button'))

    expect(useDialogService().showTopUpCreditsDialog).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('opens Plan & Credits from the legacy account menu', async () => {
    const { user, onClose } = renderComponent()

    const menuItem = screen.getByTestId('manage-plan-menu-item')
    expect(menuItem).toHaveTextContent(enMessages.credits.credits)

    await user.click(menuItem)

    expect(mockShowSettingsDialog).toHaveBeenCalledWith('workspace')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  describe('facade balance handling', () => {
    it('uses effectiveBalanceMicros when present (positive balance)', () => {
      mockBalance.value = {
        amountMicros: 200_000,
        effectiveBalanceMicros: 150_000,
        currency: 'usd'
      }

      renderComponent()

      expect(formatCreditsFromCents).toHaveBeenCalledWith({
        cents: 150_000,
        locale: 'en',
        numberOptions: {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        }
      })
      expect(screen.getByText('1500')).toBeInTheDocument()
    })

    it('uses effectiveBalanceMicros when zero', () => {
      mockBalance.value = {
        amountMicros: 100_000,
        effectiveBalanceMicros: 0,
        currency: 'usd'
      }

      renderComponent()

      expect(formatCreditsFromCents).toHaveBeenCalledWith({
        cents: 0,
        locale: 'en',
        numberOptions: {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        }
      })
      expect(screen.getByText('0')).toBeInTheDocument()
    })

    it('uses effectiveBalanceMicros when negative', () => {
      mockBalance.value = {
        amountMicros: 0,
        effectiveBalanceMicros: -50_000,
        currency: 'usd'
      }

      renderComponent()

      expect(formatCreditsFromCents).toHaveBeenCalledWith({
        cents: -50_000,
        locale: 'en',
        numberOptions: {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        }
      })
      expect(screen.getByText('-500')).toBeInTheDocument()
    })

    it('falls back to amountMicros when effectiveBalanceMicros is missing', () => {
      mockBalance.value = {
        amountMicros: 100_000,
        currency: 'usd'
      }

      renderComponent()

      expect(formatCreditsFromCents).toHaveBeenCalledWith({
        cents: 100_000,
        locale: 'en',
        numberOptions: {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        }
      })
      expect(screen.getByText('1000')).toBeInTheDocument()
    })

    it('falls back to 0 when the facade reports no balance', () => {
      mockBalance.value = null

      renderComponent()

      expect(formatCreditsFromCents).toHaveBeenCalledWith({
        cents: 0,
        locale: 'en',
        numberOptions: {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        }
      })
      expect(screen.getByText('0')).toBeInTheDocument()
    })
  })
  describe('workspace selector (non-cloud)', () => {
    const workspace = (overrides: Record<string, unknown>) => ({
      isSubscribed: false,
      subscriptionPlan: null,
      subscriptionTier: null,
      members: [],
      pendingInvites: [],
      ...overrides
    })

    const readyWorkspaceState = {
      initState: 'ready',
      activeWorkspaceId: 'ws-personal',
      isFetchingWorkspaces: false,
      workspaces: [
        workspace({
          id: 'ws-personal',
          name: 'Personal Workspace',
          type: 'personal',
          role: 'owner'
        }),
        workspace({
          id: 'ws-team',
          name: 'Team Comfy',
          type: 'team',
          role: 'member'
        })
      ]
    }

    it('stays hidden while the workspace store is not hydrated', () => {
      renderComponent()

      expect(screen.queryByTestId('workspace-switcher-trigger')).toBeNull()
    })

    it.for(['ready', 'error'])(
      'stays hidden when workspace initialization is %s without workspaces',
      (initState) => {
        renderComponent({
          initState,
          activeWorkspaceId: null,
          isFetchingWorkspaces: false,
          workspaces: []
        })

        expect(screen.queryByTestId('workspace-switcher-trigger')).toBeNull()
      }
    )

    it('shows the trigger and opens the switcher once the store is ready', async () => {
      const { user } = renderComponent(readyWorkspaceState)

      const trigger = screen.getByTestId('workspace-switcher-trigger')
      expect(trigger).toHaveAttribute('aria-expanded', 'false')
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
      expect(trigger).toHaveAttribute(
        'aria-controls',
        'workspace-switcher-panel'
      )
      expect(screen.queryByTestId('workspace-switcher-panel')).toBeNull()

      await user.click(trigger)

      const panel = screen.getByTestId('workspace-switcher-panel')
      expect(panel).toBeInTheDocument()
      expect(panel).toHaveAttribute('id', 'workspace-switcher-panel')
      expect(panel).toHaveAttribute('role', 'menu')
      expect(trigger).toHaveAttribute('aria-expanded', 'true')
    })

    it('closes the switcher on Escape or a click elsewhere', async () => {
      const { user } = renderComponent(readyWorkspaceState)
      const trigger = screen.getByTestId('workspace-switcher-trigger')

      await user.click(trigger)
      await user.keyboard('{Escape}')
      expect(screen.queryByTestId('workspace-switcher-panel')).toBeNull()

      await user.click(trigger)
      await user.click(screen.getByText('Test User'))
      expect(screen.queryByTestId('workspace-switcher-panel')).toBeNull()
    })

    it('keeps credits visible but hides top-up for workspace members', () => {
      mockCanAccessSubscriptionFeatures.value = false
      useBillingCapabilities().canTopUp = computed(() => false)
      renderComponent({
        ...readyWorkspaceState,
        activeWorkspaceId: 'ws-team'
      })

      expect(screen.getByTestId('manage-plan-menu-item')).toHaveTextContent(
        enMessages.credits.credits
      )
      expect(screen.queryByTestId('add-credits-button')).toBeNull()
    })
  })
})
